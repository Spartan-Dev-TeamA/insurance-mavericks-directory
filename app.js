/* ============================================================
   Insurance Mavericks Directory — App Logic
   ============================================================ */

// ── Reference data ──────────────────────────────────────────
const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

const STATE_NAMES = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",
  FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",
  LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",
  MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",
  NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",
  SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",
  WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"D.C."
};

const LOBS = ["Commercial P&C","Workers Comp","General Liability","Commercial Auto","BOP","Cyber","E&O / D&O","Surety & Bonds","Personal Auto","Homeowners","Renters","Umbrella","Life Insurance","Disability","Group Benefits","Health","Medicare","Annuities"];
const SPECS = ["Contractors","Restaurants","Trucking","Healthcare","Real Estate","Construction","Retail","Hospitality","Technology","Nonprofits","Agriculture","Manufacturing","Professional Services","High Value Homes","High Net Worth","Small Business","Veteran-Owned Biz","Franchise"];
const CARRIERS = ["Travelers","Hartford","Chubb","Liberty Mutual","Nationwide","Progressive","Hiscox","CNA","Zurich","AIG","Berkshire","Markel","State Auto","Erie","Cincinnati","Selective"];

// Tile map layout: 11 cols × 8 rows (53 cells; 51 are states/DC)
const MAP_LAYOUT = [
  ["AK", "", "", "", "", "", "", "", "", "", "ME"],
  ["",   "", "", "", "", "", "", "", "", "VT","NH"],
  ["WA","ID","MT","ND","MN","WI","MI","",  "NY","MA",""],
  ["OR","NV","WY","SD","IA","IL","IN","OH","PA","NJ","CT"],
  ["CA","UT","CO","NE","MO","KY","WV","VA","MD","DE","RI"],
  ["",  "AZ","NM","KS","AR","TN","NC","SC","DC","",  ""],
  ["HI","",  "",  "OK","LA","MS","AL","GA","",  "",  ""],
  ["",  "",  "",  "TX","",  "",  "",  "FL","",  "",  ""]
];

// ── Seed members (expanded) ─────────────────────────────────
// tier: 'pro' members are messageable; 'basic' members are listed but not messageable.
let members = [
  { id:1, tier:"pro",   first:"Marcus", last:"Webb", agency:"Webb Risk Management", home:"TX", phone:"(512) 555-0142", email:"marcus@webbrisk.com", states:["TX","OK","LA","AR","NM"], lobs:["Commercial P&C","General Liability","BOP","Workers Comp"], specs:["Contractors","Small Business","Construction"], carriers:["Travelers","CNA","Liberty Mutual","Hiscox"], bio:"Commercial specialist focused on the Gulf Coast region. 12 years on the producer side with deep ties to construction trades and oilfield service contractors.", years:12, joined:"Jan 2024", fb:"https://facebook.com/marcuswebb", online:true, referralsGiven:18, referralsReceived:22 },
  { id:2, tier:"pro",   first:"Diana", last:"Torres", agency:"Torres Insurance", home:"FL", phone:"(305) 555-0188", email:"diana@torresins.com", states:["FL","GA","SC","NC","AL"], lobs:["Personal Auto","Homeowners","Umbrella","Life Insurance"], specs:["High Value Homes","High Net Worth"], carriers:["Chubb","Cincinnati","Berkshire","AIG"], bio:"Personal lines expert serving the Southeast. Specialize in $2M+ homes and HNW clients with complex collections, watercraft, and umbrella exposures.", years:9, joined:"Feb 2024", fb:"", online:true, referralsGiven:31, referralsReceived:14 },
  { id:3, tier:"pro",   first:"Kevin", last:"Park", agency:"Park Commercial Group", home:"CA", phone:"(415) 555-0224", email:"kevin@parkcommercial.com", states:["CA","NV","AZ","OR","WA"], lobs:["Cyber","E&O / D&O","Commercial P&C","Workers Comp"], specs:["Technology","Real Estate","Professional Services"], carriers:["Hiscox","Chubb","Travelers","AIG"], bio:"Cyber and tech E&O specialist on the West Coast. Former underwriter at a top cyber carrier — I read the policy language so you don't have to.", years:7, joined:"Mar 2024", fb:"", online:false, referralsGiven:24, referralsReceived:19 },
  { id:4, tier:"pro",   first:"Shawna", last:"Briggs", agency:"Briggs Benefits", home:"OH", phone:"(614) 555-0319", email:"shawna@briggsbenefits.com", states:["OH","MI","IN","KY","WV"], lobs:["Group Benefits","Health","Disability","Life Insurance"], specs:["Small Business","Manufacturing","Healthcare"], carriers:["Nationwide","Cincinnati","Erie"], bio:"Group benefits consultant helping employers (10-250 lives) build competitive packages. Open to co-brokering with P&C agents who don't write benefits.", years:11, joined:"Apr 2024", fb:"", online:true, referralsGiven:9, referralsReceived:27 },
  { id:5, tier:"pro",   first:"Raul", last:"Vasquez", agency:"Southwest Risk Partners", home:"AZ", phone:"(602) 555-0411", email:"raul@swriskpartners.com", states:["AZ","TX","NM","CO","NV","UT"], lobs:["Commercial Auto","Workers Comp","General Liability","Surety & Bonds"], specs:["Trucking","Contractors","Construction"], carriers:["Progressive","Berkshire","Travelers","CNA"], bio:"Transportation and heavy equipment coverage across the Southwest. I write what others won't — long-haul, hazmat, dump truck.", years:14, joined:"May 2024", fb:"", online:false, referralsGiven:21, referralsReceived:33 },
  { id:6, tier:"basic", first:"JoAnn", last:"Schaub", agency:"Schaub Insurance Services", home:"PA", phone:"(215) 555-0567", email:"joann@schaubins.com", states:["PA","NJ","NY","DE","MD"], lobs:["Personal Auto","Homeowners","Life Insurance","Medicare"], specs:["Nonprofits","High Net Worth","Small Business"], carriers:["Erie","Cincinnati","Nationwide"], bio:"Serving families and business owners in the Mid-Atlantic. Medicare-certified — happy to handle your turning-65 referrals.", years:18, joined:"Jun 2024", fb:"", online:true, referralsGiven:17, referralsReceived:11 },
  { id:7, tier:"basic", first:"Tyrell", last:"Jackson", agency:"Jackson Surety Co", home:"GA", phone:"(404) 555-0633", email:"tyrell@jacksonsurety.com", states:["GA","FL","AL","TN","SC"], lobs:["Surety & Bonds","Commercial P&C","General Liability"], specs:["Construction","Contractors"], carriers:["Markel","Travelers","Liberty Mutual"], bio:"Surety specialist — performance, payment, license, and bid bonds. If your contractor needs a bond yesterday, call me.", years:8, joined:"Jul 2024", fb:"", online:true, referralsGiven:12, referralsReceived:8 },
  { id:8, tier:"pro",   first:"Emma", last:"Chen", agency:"Chen Cyber Advisors", home:"NY", phone:"(212) 555-0741", email:"emma@chencyber.com", states:["NY","NJ","CT","MA","PA"], lobs:["Cyber","E&O / D&O","BOP"], specs:["Technology","Professional Services","Nonprofits"], carriers:["Hiscox","Chubb","AIG","CNA"], bio:"Cyber-only broker. I quote 14 markets and handle the breach response when things go sideways. Open to partnering with generalists.", years:6, joined:"Aug 2024", fb:"", online:false, referralsGiven:35, referralsReceived:7 },
  { id:9, tier:"basic", first:"Dakota", last:"Lindberg", agency:"Lindberg Agency", home:"MN", phone:"(612) 555-0822", email:"dakota@lindbergagency.com", states:["MN","WI","IA","ND","SD"], lobs:["Personal Auto","Homeowners","Commercial Auto","BOP"], specs:["Agriculture","Small Business"], carriers:["Nationwide","State Auto","Erie","Selective"], bio:"Upper Midwest agency, third generation. Specialize in farm & ranch — crop, livestock, equipment, dwelling.", years:22, joined:"Sep 2024", fb:"", online:true, referralsGiven:14, referralsReceived:19 },
  { id:10, tier:"pro",  first:"Priya", last:"Shah", agency:"Shah Restaurant Insurance", home:"IL", phone:"(312) 555-0918", email:"priya@shahrestaurant.com", states:["IL","IN","WI","MI","OH"], lobs:["Commercial P&C","General Liability","Workers Comp","BOP"], specs:["Restaurants","Hospitality","Franchise"], carriers:["Markel","CNA","Hartford","Liberty Mutual"], bio:"Restaurants are my niche — from food trucks to 200-seat fine dining. Liquor liability, employment practices, all of it.", years:10, joined:"Oct 2024", fb:"", online:true, referralsGiven:26, referralsReceived:13 },
  { id:11, tier:"pro",  first:"Brett", last:"Calhoun", agency:"Calhoun Trucking Insurance", home:"TN", phone:"(615) 555-1037", email:"brett@calhountrucking.com", states:["TN","KY","NC","VA","AR","MS"], lobs:["Commercial Auto","Workers Comp","Surety & Bonds"], specs:["Trucking"], carriers:["Progressive","Berkshire","Zurich"], bio:"Trucking only. New ventures, owner-operators, fleets up to 50 units. I'll quote MCS-90 + cargo + auto liability same day.", years:9, joined:"Oct 2024", fb:"", online:false, referralsGiven:8, referralsReceived:24 },
  { id:12, tier:"pro",  first:"Lauren", last:"Whitfield", agency:"Whitfield Life & Annuity", home:"NC", phone:"(704) 555-1144", email:"lauren@whitfieldla.com", states:["NC","SC","VA","TN","GA","FL"], lobs:["Life Insurance","Annuities","Disability","Medicare"], specs:["High Net Worth","Professional Services"], carriers:["Nationwide","AIG","Cincinnati"], bio:"Life and annuity specialist. Estate planning, BOLI, key person, buy-sell. Refer me your business owners.", years:13, joined:"Nov 2024", fb:"", online:true, referralsGiven:11, referralsReceived:29 },
  { id:13, tier:"basic",first:"Ahmed", last:"Rashid", agency:"Rashid Risk Solutions", home:"MA", phone:"(617) 555-1268", email:"ahmed@rashidrisk.com", states:["MA","NH","RI","CT","VT","ME"], lobs:["Commercial P&C","Workers Comp","Cyber","BOP"], specs:["Technology","Healthcare","Nonprofits"], carriers:["Travelers","Chubb","Hiscox","Selective"], bio:"New England commercial. Heavy in biotech and healthcare-adjacent risks. Bilingual EN/AR.", years:11, joined:"Dec 2024", fb:"", online:false, referralsGiven:19, referralsReceived:16 },
  { id:14, tier:"basic",first:"Sierra", last:"Mendoza", agency:"Mendoza Insurance Co", home:"CO", phone:"(303) 555-1352", email:"sierra@mendozains.com", states:["CO","WY","UT","NM","KS","NE"], lobs:["Personal Auto","Homeowners","Umbrella","Commercial P&C"], specs:["High Value Homes","Small Business","Real Estate"], carriers:["Chubb","Cincinnati","Travelers"], bio:"Rocky Mountain region. Personal and small commercial. Wildfire and mountain home expertise.", years:7, joined:"Jan 2025", fb:"", online:true, referralsGiven:13, referralsReceived:9 },
  { id:15, tier:"basic",first:"Wendell", last:"Pierce", agency:"Pierce Marine & Aviation", home:"FL", phone:"(813) 555-1429", email:"wendell@piercemarine.com", states:["FL","GA","AL","LA","TX"], lobs:["Commercial P&C","General Liability","Umbrella"], specs:["Hospitality","Veteran-Owned Biz"], carriers:["Chubb","AIG","Markel"], bio:"Yacht, marina, charter boat, and private aviation specialist. Niche — call me if you've got a client with a boat.", years:16, joined:"Jan 2025", fb:"", online:false, referralsGiven:5, referralsReceived:18 },
  { id:16, tier:"pro",  first:"Mei", last:"Ishikawa", agency:"Ishikawa Group Benefits", home:"WA", phone:"(206) 555-1531", email:"mei@ishikawagb.com", states:["WA","OR","ID","CA"], lobs:["Group Benefits","Health","Disability","Life Insurance"], specs:["Technology","Small Business","Professional Services"], carriers:["Nationwide","AIG","Hartford"], bio:"PNW group benefits. I specialize in tech startups and remote-first companies (multi-state employees, no problem).", years:8, joined:"Feb 2025", fb:"", online:true, referralsGiven:22, referralsReceived:12 },
  { id:17, tier:"basic",first:"Garrett", last:"Boone", agency:"Boone Agency", home:"OK", phone:"(405) 555-1647", email:"garrett@booneagency.com", states:["OK","TX","KS","AR","MO"], lobs:["Commercial P&C","BOP","Workers Comp","Commercial Auto"], specs:["Agriculture","Construction","Trucking"], carriers:["Nationwide","Travelers","Cincinnati"], bio:"Oklahoma generalist — heavy ag and oilfield. Family agency since 1976.", years:20, joined:"Feb 2025", fb:"", online:true, referralsGiven:16, referralsReceived:14 },
  { id:18, tier:"pro",  first:"Naomi", last:"Olsen", agency:"Olsen Healthcare Risk", home:"MI", phone:"(313) 555-1758", email:"naomi@olsenhealth.com", states:["MI","OH","IL","IN","WI"], lobs:["Commercial P&C","E&O / D&O","Cyber","Workers Comp"], specs:["Healthcare","Professional Services","Nonprofits"], carriers:["Chubb","Hiscox","CNA"], bio:"Healthcare risk — hospitals, surgery centers, allied health groups. Malpractice + cyber + D&O bundled.", years:12, joined:"Mar 2025", fb:"", online:false, referralsGiven:28, referralsReceived:21 },

  // ── Scout (free) tier — listed-only, hidden from filter search ──
  { id:19, tier:"scout", first:"Tessa", last:"Vaughn", agency:"", home:"IL", phone:"", email:"", states:["IL"], lobs:["Personal Auto"], specs:[], carriers:[], bio:"", years:2, joined:"Apr 2025", fb:"", online:false, referralsGiven:0, referralsReceived:0 },
  { id:20, tier:"scout", first:"Owen", last:"Kerr", agency:"", home:"VA", phone:"", email:"", states:["VA"], lobs:["Life Insurance"], specs:[], carriers:[], bio:"", years:1, joined:"Apr 2025", fb:"", online:false, referralsGiven:0, referralsReceived:0 },
  { id:21, tier:"scout", first:"Marisol", last:"Reyes", agency:"", home:"NM", phone:"", email:"", states:["NM"], lobs:["Homeowners"], specs:[], carriers:[], bio:"", years:3, joined:"May 2025", fb:"", online:false, referralsGiven:0, referralsReceived:0 },
];

// ── App state ───────────────────────────────────────────────
let state = {
  view: "landing",         // landing | directory | map | messages | account | onboarding
  search: "",
  filterState: "",
  filterLob: "",
  selectedTile: null,
  currentUser: null,       // member object when logged in
  saved: new Set(),
  threads: [],             // [{memberId, messages:[{from:'me'|'them', text, ts}]}]
  activeThread: null,
  selectedStates: [],
  tweaks: {
    accent: "#1db954",
    accentDark: "#15903f",
    density: "comfortable",
    showStats: true
  }
};

// Pre-seed a couple of threads for demo
function seedThreads() {
  state.threads = [
    {
      memberId: 2, unread: true,
      messages: [
        { from:'them', text:"Hey — saw your bio. I've got a HNW client moving to Tampa, looking for a $4M home + 2 cars + a boat. Can you help?", ts:"Mon 9:42 AM" },
        { from:'them', text:"They want everything bundled with one carrier if possible.", ts:"Mon 9:43 AM" }
      ]
    },
    {
      memberId: 8, unread: false,
      messages: [
        { from:'me',   text:"Got a tech startup that just took Series B — 45 employees, AWS-heavy. Need cyber + EPLI. You quoting?", ts:"Fri 3:12 PM" },
        { from:'them', text:"Absolutely. Send me the application — I'll have 4 markets back by Tuesday.", ts:"Fri 3:31 PM" },
        { from:'me',   text:"Sending now. Thanks!", ts:"Fri 3:33 PM" }
      ]
    },
    {
      memberId: 11, unread: true,
      messages: [
        { from:'them', text:"Quick one — got a new owner-op in Memphis, MC just activated. Need primary + cargo + physical damage on a 2022 Freightliner. Can you bind by Friday?", ts:"Today 8:15 AM" }
      ]
    }
  ];
}

// ── Utilities ───────────────────────────────────────────────
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const initials = m => (m.first[0]+(m.last[0]||'')).toUpperCase();
const fullName = m => `${m.first} ${m.last}`;
const findMember = id => members.find(m => m.id === id);

// Avatar inner content: photo if uploaded, else initials text
function avatarInner(m) {
  return m && m.photo
    ? `<img src="${m.photo}" alt="${fullName(m)}">`
    : initials(m);
}

function showToast(msg, isErr=false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', !!isErr);
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Routing ─────────────────────────────────────────────────
const PROTECTED = new Set(['directory', 'map', 'messages', 'account']);

const GATE_COPY = {
  directory: {
    eyebrow: "Members Only",
    title: "Sign in to access the directory",
    sub: "The Mavericks directory is a private network for verified members. Sign in to browse profiles, send referrals, and connect across state lines."
  },
  map: {
    eyebrow: "Members Only",
    title: "Sign in to view the coverage map",
    sub: "See which Mavericks are licensed where, and find a partner anywhere in the country. Sign in to unlock the map."
  },
  messages: {
    eyebrow: "Members Only",
    title: "Sign in to access your inbox",
    sub: "Direct messages with other Mavericks live here. Sign in to send and receive referrals."
  },
  account: {
    eyebrow: "Members Only",
    title: "Sign in to view your account",
    sub: "Manage your profile, saved members, and referrals. Sign in to continue."
  }
};

function renderGate(forView) {
  const copy = GATE_COPY[forView] || GATE_COPY.directory;
  $('#gate-eyebrow').textContent = copy.eyebrow;
  $('#gate-title').textContent = copy.title;
  $('#gate-sub').textContent = copy.sub;
  $('#gate-perk-members').textContent = members.length;
  $('#gate-perk-states').textContent = new Set(members.flatMap(m => m.states)).size;
  $('#gate-perk-lobs').textContent = new Set(members.flatMap(m => m.lobs)).size;
}

function go(view, opts={}) {
  // Auth gate
  if (PROTECTED.has(view) && !state.currentUser) {
    state.pendingRoute = { view, opts };
    renderGate(view);
    state.view = 'gate';
    $$('.panel').forEach(p => p.classList.remove('active'));
    $('#panel-gate').classList.add('active');
    $$('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  state.view = view;
  $$('.panel').forEach(p => p.classList.remove('active'));
  $('#panel-' + view).classList.add('active');
  $$('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (view === 'directory') {
    if (opts.state) {
      state.filterState = opts.state;
      $('#filter-state').value = opts.state;
    }
    renderGrid();
  }
  if (view === 'map')      renderMap();
  if (view === 'messages') renderMessages();
  if (view === 'account')  renderAccount();
}

// ── Header / nav ────────────────────────────────────────────
function renderHeader() {
  $('#header-count').textContent = members.length;
  const stateSet = new Set(members.flatMap(m => m.states));
  $('#header-states').textContent = stateSet.size;

  const unread = state.threads.filter(t => t.unread).length;
  const badge = $('#msg-badge');
  if (unread > 0) { badge.style.display = 'inline-block'; badge.textContent = unread; }
  else { badge.style.display = 'none'; }

  if (state.currentUser) {
    $('#signin-btn').style.display = 'none';
    const av = $('#header-avatar');
    av.style.display = 'flex';
    av.innerHTML = avatarInner(state.currentUser);
  } else {
    $('#signin-btn').style.display = '';
    $('#header-avatar').style.display = 'none';
  }

  // Swap Join → My Profile when signed in
  const joinLink = $('#nav-join');
  if (joinLink) {
    if (state.currentUser) {
      joinLink.textContent = 'My Profile';
      joinLink.dataset.view = 'account';
    } else {
      joinLink.textContent = 'Join';
      joinLink.dataset.view = 'onboarding';
    }
  }
}

// ── Stats bar ───────────────────────────────────────────────
function renderStats() {
  const states = new Set(members.flatMap(m => m.states));
  const lobs = new Set(members.flatMap(m => m.lobs));
  const specs = new Set(members.flatMap(m => m.specs));
  $('#stat-members').textContent = members.length;
  $('#stat-states').textContent = states.size;
  $('#stat-lobs').textContent = lobs.size;
  $('#stat-specs').textContent = specs.size;
}

// ── Filter dropdowns ────────────────────────────────────────
function populateFilters() {
  const stateSet = new Set(members.flatMap(m => m.states));
  const lobSet = new Set(members.flatMap(m => m.lobs));
  const sf = $('#filter-state'), lf = $('#filter-lob');
  sf.innerHTML = '<option value="">All States</option>';
  [...stateSet].sort().forEach(s => {
    const o = document.createElement('option'); o.value = s; o.textContent = s; sf.appendChild(o);
  });
  lf.innerHTML = '<option value="">All Lines of Business</option>';
  [...lobSet].sort().forEach(l => {
    const o = document.createElement('option'); o.value = l; o.textContent = l; lf.appendChild(o);
  });
}

// ── Member card ─────────────────────────────────────────────
function memberCard(m, i) {
  const card = document.createElement('div');
  card.className = 'member-card' + (m.tier === 'scout' ? ' is-scout' : '');
  card.style.animationDelay = (i*0.03)+'s';
  card.onclick = (e) => { if (e.target.closest('.card-save, .contact-btn, .contact-link')) return; openProfile(m.id); };

  const isPro = m.tier === 'pro';
  const isScout = m.tier === 'scout';
  const isSaved = state.saved.has(m.id);

  // Scout cards: stripped-down (1 LOB, no contact, no specs)
  if (isScout) {
    card.innerHTML = `
      <button class="card-save ${isSaved ? 'saved' : ''}" data-id="${m.id}" aria-label="Save member">
        <svg viewBox="0 0 24 24"><path d="${isSaved ? "M6 3h12v18l-6-4.5L6 21V3z" : "M6 3h12v18l-6-4.5L6 21V3zm2 2v12.7l4-3 4 3V5H8z"}"/></svg>
      </button>
      <div class="card-header">
        <div class="avatar ${m.online ? 'online' : ''}">${avatarInner(m)}</div>
        <div class="card-head-info">
          <div class="card-name-row">
            <span class="card-name">${m.first} ${m.last}</span>
            <span class="tier-badge tier-scout">SCOUT</span>
          </div>
          <div class="card-location">${m.home}</div>
        </div>
      </div>

      <div class="scout-blur">
        <div class="scout-line">Contact info hidden — Scout tier</div>
        <div class="scout-line">Bio &amp; specializations hidden</div>
      </div>

      <div class="card-section-label">Line of Business</div>
      <div class="tag-row">${m.lobs.slice(0,1).map(l=>`<span class="tag tag-lob">${l}</span>`).join('')}</div>

      <div class="card-footer">
        <span class="member-since">Joined ${m.joined}</span>
        <button class="contact-btn locked" data-id="${m.id}" title="Scout members cannot be messaged">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>PRO ONLY
        </button>
      </div>
    `;
    return card;
  }

  const statesShow = m.states.slice(0,5);
  const statesMore = m.states.length > 5 ? `<span class="tag tag-more">+${m.states.length-5}</span>` : '';
  const lobsShow = m.lobs.slice(0,3);
  const lobsMore = m.lobs.length > 3 ? `<span class="tag tag-more">+${m.lobs.length-3}</span>` : '';

  card.innerHTML = `
    <button class="card-save ${isSaved ? 'saved' : ''}" data-id="${m.id}" aria-label="Save member">
      <svg viewBox="0 0 24 24"><path d="${isSaved
        ? "M6 3h12v18l-6-4.5L6 21V3z"
        : "M6 3h12v18l-6-4.5L6 21V3zm2 2v12.7l4-3 4 3V5H8z"
      }"/></svg>
    </button>
    <div class="card-header">
      <div class="avatar ${m.online ? 'online' : ''}">${avatarInner(m)}</div>
      <div class="card-head-info">
        <div class="card-name-row">
          <span class="card-name">${m.first} ${m.last}</span>
          ${isPro ? '<span class="tier-badge tier-pro">PRO</span>' : '<span class="tier-badge tier-basic">BASIC</span>'}
        </div>
        <div class="card-location">${m.agency ? m.agency+' &bull; ' : ''}${m.home}</div>
      </div>
    </div>

    <div class="card-contact">
      <a class="contact-link" href="tel:${m.phone.replace(/[^0-9]/g,'')}" onclick="event.stopPropagation();" title="Call ${m.first}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <span>${m.phone}</span>
      </a>
      <a class="contact-link" href="mailto:${m.email}" onclick="event.stopPropagation();" title="Email ${m.first}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6L12 13 2 6"/></svg>
        <span>${m.email}</span>
      </a>
    </div>

    <div class="card-section-label">Licensed States</div>
    <div class="tag-row">${statesShow.map(s=>`<span class="tag tag-state">${s}</span>`).join('')}${statesMore}</div>
    <div class="card-section-label">Lines of Business</div>
    <div class="tag-row">${lobsShow.map(l=>`<span class="tag tag-lob">${l}</span>`).join('')}${lobsMore}</div>
    ${m.specs.length ? `<div class="card-section-label">Specializations</div>
      <div class="tag-row">${m.specs.slice(0,3).map(s=>`<span class="tag tag-spec">${s}</span>`).join('')}${m.specs.length>3?`<span class="tag tag-more">+${m.specs.length-3}</span>`:''}</div>` : ''}
    <div class="card-footer">
      <span class="member-since">Joined ${m.joined}</span>
      ${isPro
        ? `<button class="contact-btn" data-id="${m.id}">MESSAGE</button>`
        : `<button class="contact-btn locked" data-id="${m.id}" title="Upgrade to Pro to be messaged"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>PRO ONLY</button>`
      }
    </div>
  `;
  return card;
}

// ── Render directory grid ───────────────────────────────────
function renderGrid() {
  const q = ($('#search-input').value || '').toLowerCase();
  const sf = $('#filter-state').value;
  const lf = $('#filter-lob').value;
  const grid = $('#member-grid');
  const empty = $('#empty-state');
  const chipRow = $('#active-filters');

  let filtered = members.filter(m => {
    const name = (m.first+' '+m.last+' '+(m.agency||'')).toLowerCase();
    const matchQ = !q || name.includes(q);
    const matchS = !sf || m.states.includes(sf);
    const matchL = !lf || m.lobs.includes(lf);
    // Scout tier: only visible via name lookup (a non-empty query). No filter or browse visibility.
    if (m.tier === 'scout') {
      if (!q) return false;
      if (sf || lf) return false;
      return matchQ;
    }
    return matchQ && matchS && matchL;
  });

  $('#visible-count').textContent = filtered.length;

  // Active filter chips
  chipRow.innerHTML = '';
  if (sf) {
    const c = document.createElement('button');
    c.className = 'filter-chip';
    c.innerHTML = `State: ${sf} <span class="x">×</span>`;
    c.onclick = () => { $('#filter-state').value=''; renderGrid(); };
    chipRow.appendChild(c);
  }
  if (lf) {
    const c = document.createElement('button');
    c.className = 'filter-chip';
    c.innerHTML = `LOB: ${lf} <span class="x">×</span>`;
    c.onclick = () => { $('#filter-lob').value=''; renderGrid(); };
    chipRow.appendChild(c);
  }

  grid.innerHTML = '';
  if (!filtered.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  filtered.forEach((m,i) => grid.appendChild(memberCard(m,i)));
}

// Card delegation: save + connect
document.addEventListener('click', e => {
  const save = e.target.closest('.card-save');
  if (save) {
    e.stopPropagation();
    const id = +save.dataset.id;
    if (state.saved.has(id)) { state.saved.delete(id); showToast('Removed from saved'); }
    else { state.saved.add(id); showToast('Saved to your list'); }
    renderGrid();
    if (state.view === 'account') renderAccount();
    return;
  }
  const connect = e.target.closest('.contact-btn');
  if (connect && connect.dataset.id) {
    e.stopPropagation();
    openCompose(+connect.dataset.id);
  }
});

// ── Map ─────────────────────────────────────────────────────
function memberCountByState(abbr) {
  return members.filter(m => m.states.includes(abbr)).length;
}
function densityClass(c) {
  if (c === 0) return '';
  if (c <= 2) return 'd1';
  if (c <= 4) return 'd2';
  if (c <= 6) return 'd3';
  return 'd4';
}

function renderMap() {
  const grid = $('#map-grid');
  grid.innerHTML = '';
  MAP_LAYOUT.forEach(row => {
    row.forEach(abbr => {
      const cell = document.createElement('div');
      if (!abbr) { cell.className = 'tile empty'; grid.appendChild(cell); return; }
      const count = memberCountByState(abbr);
      cell.className = `tile ${densityClass(count)}`;
      if (state.selectedTile === abbr) cell.classList.add('selected');
      cell.innerHTML = `${abbr}${count>0?`<span class="tile-count">${count}</span>`:''}`;
      cell.onclick = () => { state.selectedTile = abbr; renderMap(); };
      grid.appendChild(cell);
    });
  });
  renderStateDetail();
}

function renderStateDetail() {
  const wrap = $('#state-detail');
  if (!state.selectedTile) {
    wrap.innerHTML = `<div class="state-detail-empty">
      <p style="font-family:'Bebas Neue';font-size:20px;letter-spacing:2px;color:#555;margin-bottom:8px;">Pick a state</p>
      <p>Click any state on the map to see Mavericks licensed there. Brighter cells mean more coverage.</p>
    </div>`;
    return;
  }
  const abbr = state.selectedTile;
  const inState = members.filter(m => m.states.includes(abbr));
  wrap.innerHTML = `
    <div class="state-detail-header">
      <div class="state-detail-abbr">${abbr}</div>
      <div>
        <div class="state-detail-name">${STATE_NAMES[abbr]}</div>
        <div class="state-detail-count">${inState.length} member${inState.length===1?'':'s'} licensed</div>
      </div>
    </div>
    ${inState.length ? `
      <div class="state-member-list">
        ${inState.map(m => `
          <div class="state-member-row" data-id="${m.id}">
            <div class="avatar avatar-md">${avatarInner(m)}</div>
            <div>
              <div class="nm">${fullName(m)}</div>
              <div class="ag">${m.agency || m.home}</div>
            </div>
            <span class="arrow">→</span>
          </div>
        `).join('')}
      </div>
      <button class="view-in-directory-btn" onclick="go('directory',{state:'${abbr}'})">View ${abbr} in directory</button>
    ` : `<div class="state-detail-empty"><p>No Mavericks licensed in ${STATE_NAMES[abbr]} yet — be the first to fill the gap.</p></div>`}
  `;
  wrap.querySelectorAll('.state-member-row').forEach(row => {
    row.onclick = () => openProfile(+row.dataset.id);
  });
}

// ── Profile modal ───────────────────────────────────────────
function openProfile(id) {
  const m = findMember(id);
  if (!m) return;
  const body = $('#profile-modal-body');
  const isSaved = state.saved.has(id);
  const isPro = m.tier === 'pro';
  const isScout = m.tier === 'scout';

  // Scout profile — stripped, with upsell
  if (isScout) {
    body.innerHTML = `
      <div class="profile-banner"></div>
      <div class="profile-body">
        <div class="profile-top">
          <div class="avatar avatar-lg">${avatarInner(m)}</div>
          <div class="profile-top-info">
            <div class="profile-name-row">
              <span class="profile-name">${fullName(m)}</span>
              <span class="tier-badge tier-scout">SCOUT</span>
            </div>
            <div class="profile-loc">${m.home} &bull; Joined ${m.joined}</div>
          </div>
          <div class="profile-actions">
            <button class="action-btn locked" data-act="msg-locked">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:13px;height:13px;"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>PRO ONLY
            </button>
            <button class="action-btn ${isSaved ? 'saved' : 'ghost'}" data-act="save">${isSaved ? '★ SAVED' : '☆ SAVE'}</button>
          </div>
        </div>

        <div class="scout-upsell">
          <div class="scout-upsell-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <div class="scout-upsell-title">Scout member — limited profile</div>
            <div class="scout-upsell-body">${m.first} is on the free Scout tier. Contact info, bio, specializations, and direct messaging are hidden. ${m.first} can upgrade to unlock the full profile.</div>
          </div>
        </div>

        <div class="profile-section">
          <h4>Listed Info</h4>
          <div class="profile-listed-grid">
            <div><div class="clab">Home State</div><div class="cval">${m.home}</div></div>
            <div><div class="clab">Line of Business</div><div class="cval">${m.lobs[0] || '—'}</div></div>
          </div>
        </div>
      </div>
    `;
    body.querySelector('[data-act="msg-locked"]').onclick = () => showToast(`${m.first} is on the free Scout tier — only Pro members accept messages.`, true);
    body.querySelector('[data-act="save"]').onclick = () => {
      if (state.saved.has(id)) { state.saved.delete(id); showToast('Removed from saved'); }
      else { state.saved.add(id); showToast('Saved to your list'); }
      openProfile(id);
      renderGrid();
    };
    showModal('profile-modal');
    return;
  }

  body.innerHTML = `
    <div class="profile-banner"></div>
    <div class="profile-body">
      <div class="profile-top">
        <div class="avatar avatar-lg ${m.online ? 'online' : ''}">${avatarInner(m)}</div>
        <div class="profile-top-info">
          <div class="profile-name-row">
            <span class="profile-name">${fullName(m)}</span>
            ${isPro ? '<span class="tier-badge tier-pro">PRO</span>' : '<span class="tier-badge tier-basic">BASIC</span>'}
          </div>
          <div class="profile-agency">${m.logo ? `<span class="company-logo"><img src="${m.logo}" alt=""></span>` : ''}${m.agency || '—'}</div>
          <div class="profile-loc">${m.home} &bull; ${m.years} yrs in industry &bull; Joined ${m.joined}</div>
        </div>
        <div class="profile-actions">
          ${isPro
            ? `<button class="action-btn primary" data-act="msg">SEND MESSAGE</button>`
            : `<button class="action-btn locked" data-act="msg-locked"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:13px;height:13px;"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>PRO ONLY</button>`
          }
          <button class="action-btn ${isSaved ? 'saved' : 'ghost'}" data-act="save">${isSaved ? '★ SAVED' : '☆ SAVE'}</button>
        </div>
      </div>

      <div class="profile-contact-row">
        <a class="contact-link big" href="tel:${m.phone.replace(/[^0-9]/g,'')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <div><div class="clab">Phone</div><div class="cval">${m.phone}</div></div>
        </a>
        <a class="contact-link big" href="mailto:${m.email}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6L12 13 2 6"/></svg>
          <div><div class="clab">Email</div><div class="cval">${m.email}</div></div>
        </a>
      </div>

      <div class="profile-stats">
        <div><div class="p-stat-val">${m.states.length}</div><div class="p-stat-lab">States</div></div>
        <div><div class="p-stat-val">${m.lobs.length}</div><div class="p-stat-lab">Lines</div></div>
        <div><div class="p-stat-val">${m.referralsGiven}</div><div class="p-stat-lab">Refs Given</div></div>
        <div><div class="p-stat-val">${m.referralsReceived}</div><div class="p-stat-lab">Refs Received</div></div>
      </div>

      <div class="profile-section">
        <h4>About</h4>
        <p class="profile-bio">${m.bio}</p>
      </div>

      <div class="profile-section">
        <h4>Licensed States</h4>
        <div class="tag-row">${m.states.map(s=>`<span class="tag tag-state">${s}</span>`).join('')}</div>
      </div>

      <div class="profile-section">
        <h4>Lines of Business</h4>
        <div class="tag-row">${m.lobs.map(l=>`<span class="tag tag-lob">${l}</span>`).join('')}</div>
      </div>

      <div class="profile-section">
        <h4>Specializations</h4>
        <div class="tag-row">${m.specs.map(s=>`<span class="tag tag-spec">${s}</span>`).join('')}</div>
      </div>

      <div class="profile-section">
        <h4>Appointed Carriers</h4>
        <div class="carriers-list">${m.carriers.map(c=>`<span class="carrier-pill">${c}</span>`).join('')}</div>
      </div>

      <div class="profile-section">
        <h4>Recent Activity</h4>
        <div class="activity-list">
          <div class="activity-row">
            <div class="activity-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></div>
            <div>
              <div class="activity-text">Responded to <strong>${m.referralsReceived}</strong> referral requests this year</div>
              <div class="activity-time">Lifetime</div>
            </div>
          </div>
          <div class="activity-row">
            <div class="activity-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>
            <div>
              <div class="activity-text">Sent <strong>${m.referralsGiven}</strong> referrals to other Mavericks</div>
              <div class="activity-time">Lifetime</div>
            </div>
          </div>
          <div class="activity-row">
            <div class="activity-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6L9 17l-5-5"/></svg></div>
            <div>
              <div class="activity-text">Verified license &amp; E&amp;O on file</div>
              <div class="activity-time">Updated this quarter</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire profile action buttons
  const msgBtn = body.querySelector('[data-act="msg"]');
  if (msgBtn) msgBtn.onclick = () => { closeModal('profile-modal'); openCompose(id); };
  const lockedBtn = body.querySelector('[data-act="msg-locked"]');
  if (lockedBtn) lockedBtn.onclick = () => showToast(`${m.first} is on Basic — only Pro members accept messages.`, true);
  body.querySelector('[data-act="save"]').onclick = () => {
    if (state.saved.has(id)) { state.saved.delete(id); showToast('Removed from saved'); }
    else { state.saved.add(id); showToast('Saved to your list'); }
    openProfile(id); // refresh modal
    renderGrid();
  };

  showModal('profile-modal');
}

// ── Compose / message ───────────────────────────────────────
function openCompose(id) {
  const m = findMember(id);
  if (!m) return;
  if (m.tier !== 'pro') {
    const label = m.tier === 'scout' ? 'a Scout member' : 'on Basic';
    showToast(`${m.first} is ${label} — only Pro members can be messaged.`, true);
    return;
  }
  $('#compose-target-name').textContent = fullName(m);
  $('#compose-target-sub').textContent = `${m.agency || m.home} • ${m.home}`;
  $('#compose-avatar').innerHTML = avatarInner(m);
  $('#compose-text').value = `Hey ${m.first} — `;
  $('#compose-modal').dataset.targetId = id;
  showModal('compose-modal');
  setTimeout(() => $('#compose-text').focus(), 100);
}
function sendCompose() {
  const modal = $('#compose-modal');
  const id = +modal.dataset.targetId;
  const text = $('#compose-text').value.trim();
  if (!text) { showToast('Message can\'t be empty', true); return; }

  let thread = state.threads.find(t => t.memberId === id);
  if (!thread) {
    thread = { memberId: id, unread: false, messages: [] };
    state.threads.unshift(thread);
  }
  thread.messages.push({ from:'me', text, ts: 'Just now' });
  thread.unread = false;
  // Fake reply 1.4s later
  const m = findMember(id);
  setTimeout(() => {
    const replies = [
      "Got it — let me take a look and circle back today.",
      "Send over the details, I'll quote it.",
      `Thanks for reaching out. I can help — what's the ${m.specs[0] ? m.specs[0].toLowerCase() : 'risk'} look like?`,
      "On it. Give me an hour and I'll have something back."
    ];
    thread.messages.push({ from:'them', text: replies[Math.floor(Math.random()*replies.length)], ts: 'Just now' });
    thread.unread = state.activeThread !== id;
    renderHeader();
    if (state.view === 'messages') renderMessages();
  }, 1400);

  closeModal('compose-modal');
  showToast(`Message sent to ${m.first}`);
  renderHeader();
}

// ── Messages view ───────────────────────────────────────────
function renderMessages() {
  const list = $('#msg-list-body');
  list.innerHTML = '';

  if (!state.threads.length) {
    list.innerHTML = `<div style="padding:30px 20px;text-align:center;color:var(--muted);font-size:13px;">No conversations yet.<br>Click <strong>Connect</strong> on any member's card to start.</div>`;
    $('#msg-thread-pane').innerHTML = msgEmptyHTML();
    return;
  }

  state.threads.forEach(t => {
    const m = findMember(t.memberId);
    const last = t.messages[t.messages.length-1];
    const row = document.createElement('div');
    row.className = 'thread-item' + (t.unread ? ' unread' : '') + (state.activeThread === t.memberId ? ' active' : '');
    row.innerHTML = `
      <div class="avatar avatar-md ${m.online ? 'online' : ''}">${avatarInner(m)}</div>
      <div class="info">
        <div class="thread-name"><span>${fullName(m)}</span><span class="thread-time">${last.ts}</span></div>
        <div class="thread-preview">${last.from === 'me' ? 'You: ' : ''}${last.text}</div>
      </div>
    `;
    row.onclick = () => {
      state.activeThread = t.memberId;
      t.unread = false;
      renderMessages();
      renderHeader();
    };
    list.appendChild(row);
  });

  if (state.activeThread) renderActiveThread();
  else $('#msg-thread-pane').innerHTML = msgEmptyHTML();
}

function msgEmptyHTML() {
  return `<div class="msg-empty">
    <h3>SELECT A CONVERSATION</h3>
    <p style="font-size:13px;">Or start a new one by clicking Connect on any member's card.</p>
  </div>`;
}

function renderActiveThread() {
  const t = state.threads.find(x => x.memberId === state.activeThread);
  if (!t) return;
  const m = findMember(t.memberId);
  const pane = $('#msg-thread-pane');
  pane.innerHTML = `
    <div class="msg-thread-head">
      <div class="avatar avatar-md ${m.online ? 'online' : ''}">${avatarInner(m)}</div>
      <div>
        <div class="nm">${fullName(m)}</div>
        <div class="sub">${m.agency || m.home} • ${m.home} ${m.online ? '• online' : ''}</div>
      </div>
      <button class="view-profile" onclick="openProfile(${m.id})">VIEW PROFILE</button>
    </div>
    <div class="msg-thread-body" id="thread-body">
      ${t.messages.map(msg => `
        <div class="msg-bubble ${msg.from}">${msg.text}</div>
        <div class="msg-meta ${msg.from}">${msg.ts}</div>
      `).join('')}
    </div>
    <div class="msg-composer">
      <textarea id="reply-text" placeholder="Type a message..." rows="1"></textarea>
      <button class="send-btn" onclick="sendReply()" aria-label="Send">
        <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
      </button>
    </div>
  `;
  // Scroll to bottom
  const body = $('#thread-body');
  body.scrollTop = body.scrollHeight;

  const ta = $('#reply-text');
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
  });
}

function sendReply() {
  const ta = $('#reply-text');
  const text = ta.value.trim();
  if (!text) return;
  const t = state.threads.find(x => x.memberId === state.activeThread);
  t.messages.push({ from:'me', text, ts:'Just now' });
  ta.value = '';
  renderActiveThread();
  const m = findMember(t.memberId);
  setTimeout(() => {
    const replies = [
      "Got it.",
      "Sounds good — sending the application over now.",
      "Will follow up by EOD.",
      "Appreciate it, thanks!",
      "Let me check with my underwriter and get back to you."
    ];
    t.messages.push({ from:'them', text:replies[Math.floor(Math.random()*replies.length)], ts:'Just now' });
    if (state.view === 'messages') renderActiveThread();
  }, 1200);
}

// ── Modal helpers ───────────────────────────────────────────
function showModal(id) { $('#'+id).classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { $('#'+id).classList.remove('show'); document.body.style.overflow = ''; }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $$('.modal-backdrop.show').forEach(b => b.classList.remove('show'));
});

// ── Login (mocked) ──────────────────────────────────────────
function openLogin() { showModal('login-modal'); }
function signInAs(id) {
  state.currentUser = findMember(id) || members[0];
  closeModal('login-modal');
  showToast(`Welcome back, ${state.currentUser.first}!`);
  renderHeader();
  // Resume intended destination if there was one, else land on directory
  if (state.pendingRoute) {
    const { view, opts } = state.pendingRoute;
    state.pendingRoute = null;
    go(view, opts);
  } else if (state.view === 'gate' || state.view === 'landing') {
    go('directory');
  }
}
function signOut() {
  state.currentUser = null;
  renderHeader();
  go('landing');
  showToast('Signed out');
}

// ── Account ─────────────────────────────────────────────────
let accountTab = 'saved';
function renderAccount() {
  if (!state.currentUser) {
    $('#panel-account').innerHTML = `
      <div style="text-align:center;padding:80px 20px;">
        <h2 style="font-family:'Bebas Neue';font-size:36px;letter-spacing:2px;margin-bottom:10px;">Sign in to view your account</h2>
        <p style="color:var(--muted);font-size:14px;margin-bottom:24px;">Save members, manage your profile, and track your referrals.</p>
        <button class="btn-primary" onclick="openLogin()">SIGN IN</button>
      </div>`;
    return;
  }

  const u = state.currentUser;
  const savedList = [...state.saved].map(id => findMember(id)).filter(Boolean);

  $('#panel-account').innerHTML = `
    <div class="account-layout">
      <div class="account-sidebar">
        <div class="avatar-xl">${avatarInner(u)}</div>
        <div class="nm">${u.first} ${u.last}</div>
        <div class="role">${u.agency || u.home}</div>
        <div class="account-nav">
          <button class="account-nav-item ${accountTab==='saved'?'active':''}" data-tab="saved">★ Saved Members <span class="count">${savedList.length}</span></button>
          <button class="account-nav-item ${accountTab==='profile'?'active':''}" data-tab="profile">My Profile</button>
          <button class="account-nav-item ${accountTab==='referrals'?'active':''}" data-tab="referrals">Referrals <span class="count">${u.referralsGiven + u.referralsReceived}</span></button>
          <button class="account-nav-item ${accountTab==='settings'?'active':''}" data-tab="settings">Settings</button>
          <button class="account-nav-item" onclick="signOut()" style="margin-top:20px;color:var(--danger)">Sign out</button>
        </div>
      </div>
      <div class="account-content" id="account-content"></div>
    </div>`;

  $$('.account-nav-item[data-tab]').forEach(b => b.onclick = () => { accountTab = b.dataset.tab; renderAccount(); });
  renderAccountContent();
}

function renderAccountContent() {
  const c = $('#account-content');
  const u = state.currentUser;
  if (!c || !u) return;

  if (accountTab === 'saved') {
    const list = [...state.saved].map(id => findMember(id)).filter(Boolean);
    c.innerHTML = `
      <h2>Saved Members</h2>
      <div class="sub">Members you've bookmarked for future referrals or follow-up.</div>
      ${list.length === 0
        ? `<div class="empty-state"><h3>No Saved Members</h3><p>Click the bookmark on any card to save them here.</p></div>`
        : `<div class="saved-grid">${list.map(m => `
            <div class="saved-card" data-id="${m.id}">
              <div class="avatar avatar-md">${avatarInner(m)}</div>
              <div class="info">
                <div class="nm">${fullName(m)}</div>
                <div class="meta">${m.home} &bull; ${m.lobs[0]}</div>
              </div>
              <button class="unsave" data-id="${m.id}" title="Remove">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12v18l-6-4.5L6 21V3z"/></svg>
              </button>
            </div>`).join('')}</div>`
      }
    `;
    $$('#account-content .saved-card').forEach(el => el.onclick = (e) => {
      if (e.target.closest('.unsave')) return;
      openProfile(+el.dataset.id);
    });
    $$('#account-content .unsave').forEach(el => el.onclick = (e) => {
      e.stopPropagation();
      state.saved.delete(+el.dataset.id);
      renderAccount();
    });
  }
  else if (accountTab === 'profile') {
    c.innerHTML = `
      <h2>My Profile</h2>
      <div class="sub">How other Mavericks see you in the directory.</div>
      <div class="profile-stats" style="margin-top:8px;">
        <div><div class="p-stat-val">${u.states.length}</div><div class="p-stat-lab">States</div></div>
        <div><div class="p-stat-val">${u.lobs.length}</div><div class="p-stat-lab">Lines</div></div>
        <div><div class="p-stat-val">${u.referralsGiven}</div><div class="p-stat-lab">Refs Given</div></div>
        <div><div class="p-stat-val">${u.referralsReceived}</div><div class="p-stat-lab">Refs Received</div></div>
      </div>
      <div class="profile-section"><h4>About</h4><p class="profile-bio">${u.bio}</p></div>
      <div class="profile-section"><h4>Licensed States</h4><div class="tag-row">${u.states.map(s=>`<span class="tag tag-state">${s}</span>`).join('')}</div></div>
      <div class="profile-section"><h4>Lines of Business</h4><div class="tag-row">${u.lobs.map(l=>`<span class="tag tag-lob">${l}</span>`).join('')}</div></div>
      <div class="profile-section"><h4>Specializations</h4><div class="tag-row">${u.specs.map(s=>`<span class="tag tag-spec">${s}</span>`).join('')}</div></div>
      <button class="btn-secondary" onclick="go('onboarding')" style="margin-top:8px;">EDIT PROFILE</button>
    `;
  }
  else if (accountTab === 'referrals') {
    c.innerHTML = `
      <h2>Referrals</h2>
      <div class="sub">Track partner activity. (Mock data for demo.)</div>
      <div class="profile-stats" style="margin-top:8px;">
        <div><div class="p-stat-val">${u.referralsGiven}</div><div class="p-stat-lab">Sent</div></div>
        <div><div class="p-stat-val">${u.referralsReceived}</div><div class="p-stat-lab">Received</div></div>
        <div><div class="p-stat-val">${Math.round(u.referralsReceived*0.62)}</div><div class="p-stat-lab">Bound</div></div>
        <div><div class="p-stat-val">$${(u.referralsReceived*4.2).toFixed(1)}k</div><div class="p-stat-lab">Est. Comm.</div></div>
      </div>
      <div class="profile-section"><h4>Recent Referrals</h4>
        <div class="activity-list">
          ${members.slice(0,4).filter(m=>m.id!==u.id).map((m,i)=>`
            <div class="activity-row">
              <div class="avatar avatar-md">${avatarInner(m)}</div>
              <div style="flex:1">
                <div class="activity-text"><strong>${fullName(m)}</strong> ${i%2?'sent you':'received from you'} a referral — ${m.specs[0]}</div>
                <div class="activity-time">${['2 days ago','1 week ago','3 weeks ago','last month'][i]}</div>
              </div>
              <span class="tag tag-state" style="align-self:center;">${i%2 ? '+ '+m.home : '→ '+m.home}</span>
            </div>`).join('')}
        </div>
      </div>
    `;
  }
  else if (accountTab === 'settings') {
    c.innerHTML = `
      <h2>Settings</h2>
      <div class="sub">Demo settings — wired to local state only.</div>
      <div style="display:grid;gap:10px;max-width:480px;">
        <div class="tweak-toggle-row" style="padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;">
          <div><div style="font-weight:600;font-size:13.5px;">Receive new referral emails</div><div style="font-size:11.5px;color:var(--muted);margin-top:2px;">When other Mavericks tag you in a referral.</div></div>
          <div class="tweak-toggle on" onclick="this.classList.toggle('on')"></div>
        </div>
        <div class="tweak-toggle-row" style="padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;">
          <div><div style="font-weight:600;font-size:13.5px;">Show me as available for cross-state referrals</div><div style="font-size:11.5px;color:var(--muted);margin-top:2px;">Boost visibility in map view.</div></div>
          <div class="tweak-toggle on" onclick="this.classList.toggle('on')"></div>
        </div>
        <div class="tweak-toggle-row" style="padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;">
          <div><div style="font-weight:600;font-size:13.5px;">Weekly digest</div><div style="font-size:11.5px;color:var(--muted);margin-top:2px;">Summary of new members + niche activity.</div></div>
          <div class="tweak-toggle" onclick="this.classList.toggle('on')"></div>
        </div>
      </div>
    `;
  }
}

// ── Image uploads (headshot + logo) ─────────────────────────
const uploads = { headshot: null, logo: null };

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) { reject(new Error('Not an image')); return; }
    if (file.size > 5 * 1024 * 1024) { reject(new Error('Image must be under 5MB')); return; }
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

function applyUploadPreview(target, dataUrl) {
  uploads[target] = dataUrl;
  const tile = document.querySelector(`.upload-tile[data-target="${target}"]`);
  const preview = $('#preview-' + target);
  if (!tile || !preview) return;
  if (dataUrl) {
    preview.innerHTML = `<img src="${dataUrl}" alt="">`;
    tile.classList.add('has-image');
  } else {
    preview.innerHTML = `<span class="upload-icon">${target === 'headshot'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/></svg>'
    }</span>`;
    tile.classList.remove('has-image');
  }
}

function wireUploadTile(target) {
  const tile = document.querySelector(`.upload-tile[data-target="${target}"]`);
  if (!tile) return;
  const input = tile.querySelector('input[type="file"]');

  const handleFile = async (file) => {
    try {
      const url = await readImageFile(file);
      applyUploadPreview(target, url);
    } catch (e) {
      showToast(e.message || 'Could not load image', true);
    }
  };

  input.addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  });

  // Drag & drop
  tile.addEventListener('dragover', e => { e.preventDefault(); tile.classList.add('dragging'); });
  tile.addEventListener('dragleave', () => tile.classList.remove('dragging'));
  tile.addEventListener('drop', e => {
    e.preventDefault();
    tile.classList.remove('dragging');
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  });

  // Change / Remove buttons (stop propagation so we don't re-open file picker on remove)
  tile.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (btn.dataset.action === 'remove') {
        applyUploadPreview(target, null);
        input.value = '';
      } else {
        input.click();
      }
    });
  });
}

// ── Onboarding (kept from original) ─────────────────────────
function initStateFormGrid() {
  const grid = $('#state-form-grid');
  STATES.forEach(s => {
    const chip = document.createElement('label');
    chip.className = 'state-chip';
    chip.innerHTML = `<input type="checkbox" value="${s}"><span>${s}</span>`;
    chip.addEventListener('click', () => {
      const cb = chip.querySelector('input');
      setTimeout(() => {
        if (cb.checked) { chip.classList.add('selected'); if (!state.selectedStates.includes(s)) state.selectedStates.push(s); }
        else { chip.classList.remove('selected'); state.selectedStates = state.selectedStates.filter(x => x !== s); }
      }, 0);
    });
    grid.appendChild(chip);
  });
}
function initCheckboxGrid(id, items) {
  const grid = $('#' + id);
  items.forEach(item => {
    const label = document.createElement('label');
    label.className = 'checkbox-item';
    label.innerHTML = `<input type="checkbox" value="${item}"><span>${item}</span>`;
    grid.appendChild(label);
  });
}
function getChecked(id) {
  return Array.from(document.querySelectorAll(`#${id} input:checked`)).map(c => c.value);
}

function submitForm() {
  const first = $('#f-first').value.trim();
  const last = $('#f-last').value.trim();
  const home = $('#f-homestate').value.trim().toUpperCase();
  if (!first || !last || !home) { showToast('Please fill in name and home state.', true); return; }
  if (!state.selectedStates.length) { showToast('Select at least one licensed state.', true); return; }
  const lobs = getChecked('lob-grid');
  const specs = getChecked('spec-grid');
  if (!lobs.length) { showToast('Select at least one line of business.', true); return; }

  const tier = state.lockedTier || state.joinTier || 'scout';
  const now = new Date();
  const joined = now.toLocaleString('default', { month:'short' }) + ' ' + now.getFullYear();
  const memberData = {
    id: Date.now(), first, last,
    agency: $('#f-agency').value.trim(),
    home, states: [...state.selectedStates], lobs, specs,
    carriers: tier === 'pro' ? ["Travelers","Nationwide","Chubb"] : tier === 'basic' ? ["Travelers","Nationwide"] : [],
    bio: $('#f-bio').value.trim() || (tier === 'scout' ? '' : 'New Insurance Mavericks member.'),
    years: 1, joined, fb: $('#f-fb').value.trim(),
    online: true, referralsGiven: 0, referralsReceived: 0,
    tier,
    phone: '', email: '',
    photo: uploads.headshot || null,
    logo: uploads.logo || null
  };

  // Paid tier → push through checkout first (unless they've already paid via pricing route)
  if ((tier === 'basic' || tier === 'pro') && !state.lockedTier) {
    state.pendingJoin = memberData;
    openCheckout(tier);
    return;
  }

  // Already paid (lockedTier) or Scout — add immediately
  if (state.lockedTier && state.currentUser) {
    // Merge form data into the existing currentUser record (created at checkout)
    Object.assign(state.currentUser, memberData, { id: state.currentUser.id, tier: state.lockedTier, email: state.currentUser.email });
    unlockJoinTier();
    finishJoin(null);
    return;
  }

  finishJoin(memberData);
}

function finishJoin(memberData) {
  if (memberData) members.unshift(memberData);

  // Reset form
  $$('#panel-onboarding input[type=text], #panel-onboarding textarea').forEach(el => el.value = '');
  $$('#panel-onboarding input[type=checkbox]').forEach(cb => cb.checked = false);
  $$('.state-chip').forEach(c => c.classList.remove('selected'));
  $$('.checkbox-item').forEach(c => { const cb = c.querySelector('input'); if (cb) cb.checked = false; });
  state.selectedStates = [];
  applyUploadPreview('headshot', null);
  applyUploadPreview('logo', null);
  if (!state.lockedTier) selectJoinTier('scout');

  populateFilters();
  renderHeader();
  renderStats();
  showToast('You\'re live in the directory!');
  go('directory');
}

function selectJoinTier(tier) {
  if (state.lockedTier) return; // can't change once paid
  state.joinTier = tier;
  $$('.tier-option').forEach(o => o.classList.toggle('selected', o.dataset.tier === tier));
  const note = $('#tier-select-note');
  const btn = $('#submit-form-btn');
  if (tier === 'scout') {
    note.textContent = "You'll be listed instantly with no payment. Upgrade anytime.";
    note.classList.remove('pay');
    if (btn) btn.textContent = 'SUBMIT TO DIRECTORY';
  } else {
    const price = tier === 'pro' ? '$20.82/mo' : '$14.87/mo';
    note.innerHTML = `After you fill out the form, you'll be sent to <strong>secure checkout</strong> for ${tier.toUpperCase()} (${price}). Your listing goes live once payment clears.`;
    note.classList.add('pay');
    if (btn) btn.textContent = `CONTINUE TO CHECKOUT — ${price.toUpperCase()}`;
  }
}

function lockJoinTier(tier) {
  state.lockedTier = tier;
  state.joinTier = tier;
  document.body.dataset.tierLocked = '1';
  const banner = $('#tier-locked-banner');
  if (banner) {
    banner.style.display = 'flex';
    $('#tier-locked-name').textContent = tier.toUpperCase();
  }
  const btn = $('#submit-form-btn');
  if (btn) btn.textContent = 'GO LIVE IN DIRECTORY';
}

function unlockJoinTier() {
  state.lockedTier = null;
  document.body.dataset.tierLocked = '';
  const banner = $('#tier-locked-banner');
  if (banner) banner.style.display = 'none';
  selectJoinTier('scout');
}

// ── Landing helpers ─────────────────────────────────────────
function renderHeroPreview() {
  $('#hero-stat-members').textContent = members.length;
  $('#hero-stat-states').textContent = new Set(members.flatMap(m => m.states)).size;
  $('#hero-stat-lobs').textContent = new Set(members.flatMap(m => m.lobs)).size;

  const list = $('#hero-member-list');
  const featured = [members[1], members[2], members[7], members[4]];
  list.innerHTML = featured.map(m => `
    <div class="hero-member-row" data-id="${m.id}">
      <div class="avatar-sm ${m.online?'online':''}">${avatarInner(m)}</div>
      <div>
        <div class="nm">${fullName(m)}</div>
        <div class="loc">${m.home} &bull; ${m.lobs[0]}</div>
      </div>
      <span class="meta">${m.states.length} states</span>
    </div>
  `).join('');
  list.querySelectorAll('.hero-member-row').forEach(el => {
    el.onclick = () => openProfile(+el.dataset.id);
  });
}

// ── Tweaks ──────────────────────────────────────────────────
const ACCENT_OPTIONS = [
  { name: 'Maverick Green', c:'#1db954', d:'#15903f', g:'rgba(29,185,84,' },
  { name: 'Maverick Blue',  c:'#3b82f6', d:'#1e4fa3', g:'rgba(59,130,246,' },
  { name: 'Maverick Amber', c:'#f5a524', d:'#b8780f', g:'rgba(245,165,36,' },
  { name: 'Maverick Magenta', c:'#e0438f', d:'#a02669', g:'rgba(224,67,143,' },
];

function setAccent(idx) {
  const a = ACCENT_OPTIONS[idx];
  const root = document.documentElement;
  root.style.setProperty('--green', a.c);
  root.style.setProperty('--green-dark', a.d);
  root.style.setProperty('--green-glow', a.g + '0.18)');
  root.style.setProperty('--green-glow-strong', a.g + '0.32)');
  state.tweaks.accentIdx = idx;
  $$('.tweak-swatch').forEach((sw, i) => sw.classList.toggle('selected', i === idx));
}

function setDensity(d) {
  document.body.dataset.density = d;
  state.tweaks.density = d;
  $$('#tweak-density button').forEach(b => b.classList.toggle('active', b.dataset.val === d));
}

function toggleStats() {
  state.tweaks.showStats = !state.tweaks.showStats;
  document.body.classList.toggle('hide-stats', !state.tweaks.showStats);
  $('#tweak-stats-toggle').classList.toggle('on', state.tweaks.showStats);
}

function initTweaks() {
  // Swatches
  const swatchRow = $('#tweak-swatches');
  ACCENT_OPTIONS.forEach((a, i) => {
    const sw = document.createElement('div');
    sw.className = 'tweak-swatch' + (i === 0 ? ' selected' : '');
    sw.style.background = a.c;
    sw.title = a.name;
    sw.onclick = () => setAccent(i);
    swatchRow.appendChild(sw);
  });
  // Density
  $$('#tweak-density button').forEach(b => b.onclick = () => setDensity(b.dataset.val));
  // Stats toggle
  $('#tweak-stats-toggle').onclick = toggleStats;

  // Edit-mode protocol
  window.addEventListener('message', (e) => {
    if (e.data?.type === '__activate_edit_mode')   $('#tweaks-panel').classList.add('show');
    if (e.data?.type === '__deactivate_edit_mode') $('#tweaks-panel').classList.remove('show');
  });
  window.parent.postMessage({ type: '__edit_mode_available' }, '*');

  $('#tweaks-close').onclick = () => {
    $('#tweaks-panel').classList.remove('show');
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };
}

// ── Checkout (Stripe-style mocked flow) ─────────────────────
// 🚀 PRODUCTION INTEGRATION:
// Replace `runMockedCheckout()` with a call to your backend endpoint
// that creates a Stripe Checkout Session, then either:
//   (a) redirect with stripe.redirectToCheckout({ sessionId })
//   (b) load Stripe Elements for in-page payment (PaymentElement)
// Required pieces on your backend:
//   - POST /create-checkout-session  →  returns { sessionId } and uses your STRIPE_SECRET_KEY
//   - Webhook handler for `checkout.session.completed` to upgrade the user's tier
// Required on the frontend:
//   - const stripe = Stripe(STRIPE_PUBLISHABLE_KEY)
//   - <script src="https://js.stripe.com/v3/"></script>

const PLAN_CATALOG = {
  scout: { name: "Scout",  monthly: 0,      annual: 0,      annualTotal: 0      },
  basic: { name: "Basic",  monthly: 14.87,  annual: 8.15,   annualTotal: 97.84  },
  pro:   { name: "Pro",    monthly: 20.82,  annual: 11.42,  annualTotal: 136.98 }
};

const PLAN_INCLUDES = {
  basic: ["Directory listing", "Phone & email displayed", "Searchable profile", "Lines of business tags", "Licensed states display"],
  pro:   ["Everything in Basic", "Direct messaging from members", "Verified Maverick badge", "Priority placement in search", "Referral lead eligibility"]
};

function isAnnualBilling() {
  return $('#billing-toggle')?.classList.contains('is-annual');
}

function openCheckout(plan) {
  // Scout is free — just route into onboarding to capture the listing.
  if (plan === 'scout') { go('onboarding'); return; }

  // Track where this checkout originated so success can route correctly
  // - 'form':    user filled the onboarding form, paid → land on directory (profile already complete)
  // - 'upgrade': existing signed-in user upgrading → land on directory
  // - 'pricing': came from pricing page without a profile → land on onboarding to set up profile
  state.checkoutOrigin = state.pendingJoin
    ? 'form'
    : (state.currentUser ? 'upgrade' : 'pricing');

  const isAnnual = isAnnualBilling();
  const cat = PLAN_CATALOG[plan];
  const price = isAnnual ? cat.annualTotal : cat.monthly;
  const priceStr = `$${(isAnnual ? cat.annual : cat.monthly).toFixed(2)}`;
  const totalStr = `$${price.toFixed(2)}`;

  $('#co-plan-name').textContent = `Mavericks ${cat.name}`;
  $('#co-price').textContent = priceStr;
  $('#co-period').textContent = isAnnual ? 'per month, billed annually' : 'per month';
  $('#co-billing-note').textContent = isAnnual
    ? `Billed $${cat.annualTotal.toFixed(2)} once per year. Cancel anytime.`
    : `Billed monthly. Cancel anytime.`;
  $('#co-line-name').textContent = `Mavericks ${cat.name} (${isAnnual ? 'annual' : 'monthly'})`;
  $('#co-line-price').textContent = totalStr;
  $('#co-total').textContent = totalStr;
  $('#co-submit-amount').textContent = totalStr;
  $('#co-includes').innerHTML = (PLAN_INCLUDES[plan] || []).map(x => `<li>${x}</li>`).join('');

  // Pre-fill email if signed in
  if (state.currentUser && state.currentUser.email) {
    $('#co-email').value = state.currentUser.email;
    $('#co-name').value = `${state.currentUser.first} ${state.currentUser.last}`;
  }

  // Reset UI to form view
  $('#co-success').classList.remove('show');
  $('#co-form-wrap').style.display = '';
  $('#co-submit').classList.remove('loading');
  $('#checkout-modal').dataset.plan = plan;
  $('#checkout-modal').dataset.amount = price.toFixed(2);

  showModal('checkout-modal');
}

// Card number formatter — spaces every 4 digits, max 16
function formatCardNumber(v) {
  const digits = v.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

// Brand detection
function detectBrand(v) {
  const d = v.replace(/\D/g, '');
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mc';
  if (/^3[47]/.test(d)) return 'amex';
  return null;
}

function formatExpiry(v) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  if (d.length < 3) return d;
  return d.slice(0, 2) + ' / ' + d.slice(2);
}

function initCheckoutHandlers() {
  const card = $('#co-card');
  const exp = $('#co-exp');
  const cvc = $('#co-cvc');

  card.addEventListener('input', () => {
    card.value = formatCardNumber(card.value);
    const brand = detectBrand(card.value);
    $$('.brand-icon').forEach(b => b.classList.toggle('active', b.dataset.brand === brand));
  });

  exp.addEventListener('input', () => { exp.value = formatExpiry(exp.value); });
  cvc.addEventListener('input', () => { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });

  $('#co-submit').onclick = () => runMockedCheckout();
  $('#co-success-continue').onclick = () => {
    closeModal('checkout-modal');
    if (state.checkoutOrigin === 'pricing') {
      // Lock the tier they paid for and send them to profile setup
      lockJoinTier(state.currentUser?.tier || 'pro');
      go('onboarding');
    } else {
      go('directory');
    }
  };
}

function validateCheckout() {
  const email = $('#co-email').value.trim();
  const card = $('#co-card').value.replace(/\s/g, '');
  const exp = $('#co-exp').value.replace(/\s/g, '');
  const cvc = $('#co-cvc').value;
  const name = $('#co-name').value.trim();

  let ok = true;
  const setInvalid = (sel, bad) => $(sel).classList.toggle('invalid', bad);

  if (!/.+@.+\..+/.test(email)) { setInvalid('#co-email', true); ok = false; } else setInvalid('#co-email', false);
  if (card.length < 15) { setInvalid('#co-card', true); ok = false; } else setInvalid('#co-card', false);
  if (!/^\d{2}\/\d{2}$/.test(exp)) { setInvalid('#co-exp', true); ok = false; } else setInvalid('#co-exp', false);
  if (cvc.length < 3) { setInvalid('#co-cvc', true); ok = false; } else setInvalid('#co-cvc', false);
  if (!name) { setInvalid('#co-name', true); ok = false; } else setInvalid('#co-name', false);

  return ok;
}

function runMockedCheckout() {
  if (!validateCheckout()) {
    showToast('Please fill in all fields correctly.', true);
    return;
  }

  // ★ REAL STRIPE WIRING WOULD GO HERE ★
  // const stripe = Stripe(PUBLISHABLE_KEY);
  // const { sessionId } = await fetch('/api/create-checkout-session', { method:'POST', body: JSON.stringify({ plan, billing }) }).then(r=>r.json());
  // await stripe.redirectToCheckout({ sessionId });

  const btn = $('#co-submit');
  btn.classList.add('loading');
  btn.disabled = true;

  setTimeout(() => {
    btn.classList.remove('loading');
    btn.disabled = false;

    // Apply subscription to demo state
    const plan = $('#checkout-modal').dataset.plan;
    const amount = parseFloat($('#checkout-modal').dataset.amount).toFixed(2);
    const card = $('#co-card').value.replace(/\s/g, '');
    const last4 = card.slice(-4);

    // Upgrade or create a user
    if (state.pendingJoin) {
      // Came from the onboarding form
      const data = state.pendingJoin;
      state.pendingJoin = null;
      data.tier = plan;
      data.email = $('#co-email').value.trim() || data.email;
      members.unshift(data);
      state.currentUser = data;
      // Reset onboarding form
      $$('#panel-onboarding input[type=text], #panel-onboarding textarea').forEach(el => el.value = '');
      $$('#panel-onboarding input[type=checkbox]').forEach(cb => cb.checked = false);
      $$('.state-chip').forEach(c => c.classList.remove('selected'));
      $$('.checkbox-item').forEach(c => { const cb = c.querySelector('input'); if (cb) cb.checked = false; });
      state.selectedStates = [];
      applyUploadPreview('headshot', null);
      applyUploadPreview('logo', null);
      selectJoinTier('scout');
      populateFilters();
    } else if (state.currentUser) {
      state.currentUser.tier = plan;
    } else {
      const email = $('#co-email').value.trim();
      const name = $('#co-name').value.trim().split(' ');
      const newMember = {
        id: Date.now(),
        tier: plan,
        first: name[0] || 'New',
        last: name.slice(1).join(' ') || 'Member',
        agency: '',
        home: '—',
        phone: '',
        email,
        states: [],
        lobs: [],
        specs: [],
        carriers: [],
        bio: '',
        years: 0,
        joined: new Date().toLocaleString('default',{month:'short'}) + ' ' + new Date().getFullYear(),
        fb: '', online: true,
        referralsGiven: 0, referralsReceived: 0
      };
      members.unshift(newMember);
      state.currentUser = newMember;
    }

    // Pre-fill the onboarding form for users coming from pricing (they still need to set up the profile)
    if (state.checkoutOrigin === 'pricing' && state.currentUser) {
      const u = state.currentUser;
      const fFirst = $('#f-first'); if (fFirst) fFirst.value = u.first;
      const fLast  = $('#f-last');  if (fLast)  fLast.value  = u.last;
      const fHome  = $('#f-homestate'); if (fHome) fHome.value = u.home || '';
    }

    // Populate success state
    $('#co-success-msg').textContent = `Welcome to Mavericks ${PLAN_CATALOG[plan].name}. ${plan === 'pro' ? "Your profile is now messageable" : "You're live in the directory"} and your card has been charged.`;
    $('#co-receipt-id').textContent = 'im_' + Math.random().toString(36).slice(2, 10);
    $('#co-receipt-card').textContent = `•••• ${last4}`;
    $('#co-receipt-total').textContent = '$' + amount;
    $('#co-success').classList.add('show');

    renderHeader();
    renderStats();
    populateFilters();
    showToast(`Subscribed to ${PLAN_CATALOG[plan].name}!`);
  }, 1500);
}

// ── Pricing toggle ──────────────────────────────────────────
function setBilling(mode) {
  const toggle = $('#billing-toggle');
  const sw = $('#billing-switch');
  const isAnnual = mode === 'annual';
  toggle.classList.toggle('is-annual', isAnnual);
  sw.classList.toggle('annual', isAnnual);
  $$('.billing-label').forEach(l => l.classList.toggle('active', l.dataset.bill === mode));
  $$('.price-amount').forEach(el => {
    el.textContent = isAnnual ? el.dataset.annual : el.dataset.monthly;
  });
  $$('.price-billed').forEach(el => {
    el.textContent = isAnnual ? el.dataset.annual : el.dataset.monthly;
  });
}

// ── Init ────────────────────────────────────────────────────
function init() {
  // Nav wiring
  $$('.nav-link').forEach(b => b.onclick = () => go(b.dataset.view));
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  $$('.logo-wrap').forEach(b => b.onclick = () => go('landing'));

  // Header buttons
  $('#signin-btn').onclick = openLogin;
  $('#header-avatar').onclick = () => go('account');
  $('#gate-signin').onclick = openLogin;

  // Modal close buttons
  $$('.modal-close').forEach(b => b.onclick = () => closeModal(b.closest('.modal-backdrop').id));
  $$('.modal-backdrop').forEach(b => b.onclick = (e) => {
    if (e.target === b) closeModal(b.id);
  });

  // Login modal — demo accounts
  const demoRow = $('#demo-accounts');
  [1, 2, 4, 8].forEach(id => {
    const m = findMember(id);
    const row = document.createElement('div');
    row.className = 'demo-row';
    row.onclick = () => signInAs(id);
    row.innerHTML = `
      <div class="avatar avatar-md">${avatarInner(m)}</div>
      <div class="info">
        <div class="nm">${fullName(m)}</div>
        <div class="role">${m.agency || m.home}</div>
      </div>
      <span class="arrow">→</span>
    `;
    demoRow.appendChild(row);
  });

  // Onboarding form
  initStateFormGrid();
  initCheckboxGrid('lob-grid', LOBS);
  initCheckboxGrid('spec-grid', SPECS);
  $('#submit-form-btn').onclick = submitForm;
  wireUploadTile('headshot');
  wireUploadTile('logo');

  // Tier selector
  $$('.tier-option').forEach(opt => opt.onclick = () => selectJoinTier(opt.dataset.tier));
  state.joinTier = 'scout';

  // Compose
  $('#compose-send').onclick = sendCompose;
  $('#compose-text').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendCompose(); }
  });

  // Filters
  $('#search-input').oninput = renderGrid;
  $('#filter-state').onchange = renderGrid;
  $('#filter-lob').onchange = renderGrid;

  // Tweaks
  initTweaks();

  // Checkout
  initCheckoutHandlers();
  $$('.tier-cta').forEach(b => {
    const card = b.closest('.price-card');
    const tier = card?.dataset.tier;
    if (tier) {
      b.removeAttribute('data-go');
      b.onclick = () => openCheckout(tier);
    }
  });

  // Pricing toggle
  $('#billing-switch').onclick = () => {
    const isAnnual = $('#billing-toggle').classList.contains('is-annual');
    setBilling(isAnnual ? 'monthly' : 'annual');
  };
  $$('.billing-label').forEach(l => l.onclick = () => setBilling(l.dataset.bill));

  // Seed
  seedThreads();
  populateFilters();
  renderHeader();
  renderStats();
  renderHeroPreview();
  renderGrid();

  // Start on landing
  go('landing');
}

document.addEventListener('DOMContentLoaded', init);
