#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const container='im-email-db-test-'+Date.now(), database='insurance_mavericks';
let failed=false;
function report(name,passed,detail=''){console.log((passed?'PASS ':'FAIL ')+name+(detail?' — '+detail:''));if(!passed)failed=true;}
function docker(args,o={}){return spawnSync('docker',args,{encoding:'utf8',input:o.input,timeout:o.timeout||30000});}
function psql(sql,o={}){return docker(['exec','-i',container,'psql','-X','-v','ON_ERROR_STOP=1','-Atq','-U','postgres','-d',database],{input:sql,timeout:o.timeout||30000});}
function psqlAsync(sql){return new Promise(resolve=>{const c=spawn('docker',['exec','-i',container,'psql','-X','-v','ON_ERROR_STOP=1','-Atq','-U','postgres','-d',database],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';c.stdout.setEncoding('utf8');c.stderr.setEncoding('utf8');c.stdout.on('data',x=>stdout+=x);c.stderr.on('data',x=>stderr+=x);c.on('close',status=>resolve({status,stdout,stderr}));c.stdin.end(sql);});}
function assertSql(sql,expected){const r=psql(sql);if(r.status!==0)throw new Error(r.stderr.trim()||'psql failed');return r.stdout.trim()===expected;}
const ids={low:'10000000-0000-4000-8000-000000000001',high:'20000000-0000-4000-8000-000000000002',outsider:'30000000-0000-4000-8000-000000000003',thread:'40000000-0000-4000-8000-000000000004',message:'50000000-0000-4000-8000-000000000005'};
try{
 const started=docker(['run','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD=test-only','-e','POSTGRES_DB='+database,'postgres:15'],{timeout:120000});
 if(started.status!==0)throw new Error(started.stderr.trim()||'docker run failed');
 let ready=false;for(let n=0;n<30;n++){if(docker(['exec',container,'pg_isready','-U','postgres','-d',database]).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}if(!ready)throw new Error('Postgres did not become ready.');
 const bootstrap=`
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key,email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create schema if not exists storage;
create table if not exists storage.buckets(id text primary key,name text not null,public boolean not null default false);
create table if not exists storage.objects(id text primary key,bucket_id text,name text);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select regexp_split_to_array(name,'/') $$;
alter default privileges for role postgres in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges for role postgres in schema public grant usage,select on sequences to anon,authenticated,service_role;
`;
 const boot=psql(bootstrap);if(boot.status!==0)throw new Error(boot.stderr.trim()||'bootstrap failed');
 for(const name of ['0001_init.sql','0002_tiers_and_messaging.sql','0003_harden_tiers_and_messaging.sql','0004_email_notifications.sql']){const sql=await fs.readFile(path.join(repo,'supabase','migrations',name),'utf8'),a=psql(sql,{timeout:60000});if(a.status!==0)throw new Error(name+': '+a.stderr.trim());}
 report('migrations 0001-0004 apply in order',true);
 const fixtures=`
insert into auth.users(id,email) values ('${ids.low}','low@example.test'),('${ids.high}','high@example.test'),('${ids.outsider}','outside@example.test');
insert into public.profiles(user_id,first_name,last_name,home_state,states,lobs) values
('${ids.low}','Low','Member','NY',array['NY'],array['Life Insurance']),
('${ids.high}','High','Member','NY',array['NY'],array['Life Insurance']),
('${ids.outsider}','Outside','Member','NY',array['NY'],array['Life Insurance']);
insert into public.message_threads(id,user_low,user_high) values ('${ids.thread}','${ids.low}','${ids.high}');
insert into public.messages(id,thread_id,sender_id,body) values ('${ids.message}','${ids.thread}','${ids.high}','Integration test');
`;
 const seeded=psql(fixtures);if(seeded.status!==0)throw new Error(seeded.stderr.trim()||'fixture setup failed');
 const welcomeClaim=`begin;update public.profiles set welcomed_at=now() where user_id='${ids.low}' and welcomed_at is null returning user_id;select pg_sleep(0.5);commit;`;
 const wr=await Promise.all([psqlAsync(welcomeClaim),psqlAsync(welcomeClaim)]),ww=wr.reduce((n,r)=>n+r.stdout.split(ids.low).length-1,0);
 report('concurrent welcome claims have one winner',wr.every(r=>r.status===0)&&ww===1,'winners='+ww);
 const latchClaim=`begin;update public.message_threads t set notify_claimed_low=true where t.id='${ids.thread}' and t.notify_claimed_low=false and exists(select 1 from public.messages m where m.id='${ids.message}' and m.read=false) returning t.id;select pg_sleep(0.5);commit;`;
 const lr=await Promise.all([psqlAsync(latchClaim),psqlAsync(latchClaim)]),lw=lr.reduce((n,r)=>n+r.stdout.split(ids.thread).length-1,0);
 report('concurrent unread latch claims have one winner',lr.every(r=>r.status===0)&&lw===1,'winners='+lw);
 const rearm=assertSql(`select set_config('request.jwt.claim.sub','${ids.low}',false);select public.mark_thread_read('${ids.thread}');select (not notify_claimed_low)::text||','||(select bool_and(read)::text from public.messages where thread_id='${ids.thread}') from public.message_threads where id='${ids.thread}';`,ids.low+'\n\ntrue,true');
 report('mark_thread_read re-arms caller latch',rearm);
 const reset=psql(`update public.profiles set tier='free' where user_id='${ids.high}';`);if(reset.status!==0)throw new Error(reset.stderr.trim());
 const tierClaim=`begin;update public.profiles set tier='pro' where user_id='${ids.high}' and tier='free' returning user_id;select pg_sleep(0.5);commit;`;
 const tr=await Promise.all([psqlAsync(tierClaim),psqlAsync(tierClaim)]),tw=tr.reduce((n,r)=>n+r.stdout.split(ids.high).length-1,0);
 report('concurrent CAS tier transition has one owner',tr.every(r=>r.status===0)&&tw===1,'owners='+tw);
 const visibility=assertSql(`set role authenticated;select has_table_privilege('authenticated','public.message_threads','select')::text||','||has_column_privilege('authenticated','public.message_threads','id','select')::text||','||has_column_privilege('authenticated','public.message_threads','notify_claimed_low','select')::text;`,'false,true,false');
 const forbidden=psql(`set role authenticated;select notify_claimed_low from public.message_threads limit 1;`);
 report('message_threads exposes only browser-safe columns',visibility&&forbidden.status!==0);
 const rls=psql(`set role authenticated;select set_config('request.jwt.claim.sub','${ids.low}',false);select count(*) from public.messages where id='${ids.message}';select set_config('request.jwt.claim.sub','${ids.outsider}',false);select count(*) from public.messages where id='${ids.message}';`),lines=rls.stdout.trim().split(/\r?\n/);
 report('messages RLS still allows participants and rejects outsiders',rls.status===0&&lines.join(',')===ids.low+',1,'+ids.outsider+',0',rls.status===0?lines.join(','):rls.stderr.trim());
}catch(error){report('integration setup/execution',false,error.message);}
finally{const stopped=docker(['stop',container],{timeout:30000});if(stopped.status!==0&&!/No such container/i.test(stopped.stderr||''))report('container teardown',false,stopped.stderr.trim());else report('container teardown',true);}
if(failed)process.exitCode=1;
