const AUTH_PAGE_SIZE = 1000;
const TABLE_PAGE_SIZE = 1000;

// This full auth-user scan is intentionally simple at the current scale. Past
// roughly a few thousand users it needs a persisted scan cursor so later pages
// cannot starve time-bounded scheduled runs.
async function listAllAuthUsers(service) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: AUTH_PAGE_SIZE
    });
    if (error) throw error;
    const pageUsers = data && Array.isArray(data.users) ? data.users : [];
    users.push(...pageUsers);
    if (pageUsers.length < AUTH_PAGE_SIZE) break;
  }
  return users;
}

async function listAllRows(service, table, columns) {
  const rows = [];
  for (let from = 0; ; from += TABLE_PAGE_SIZE) {
    const { data, error } = await service.from(table)
      .select(columns)
      .range(from, from + TABLE_PAGE_SIZE - 1);
    if (error) throw error;
    const pageRows = data || [];
    rows.push(...pageRows);
    if (pageRows.length < TABLE_PAGE_SIZE) break;
  }
  return rows;
}

async function listIncompleteUsers(service) {
  const [users, profiles, nudges] = await Promise.all([
    listAllAuthUsers(service),
    listAllRows(service, 'profiles', 'user_id'),
    listAllRows(service, 'onboarding_nudges', 'user_id,nudge_count,nudged_at,opted_out')
  ]);

  const profileIds = new Set(profiles.map((profile) => profile.user_id));
  const nudgeByUserId = new Map(nudges.map((nudge) => [nudge.user_id, nudge]));

  return users
    .filter((user) => !profileIds.has(user.id))
    .map((user) => {
      const nudge = nudgeByUserId.get(user.id);
      return {
        id: user.id,
        email: user.email || null,
        created_at: user.created_at || null,
        last_sign_in_at: user.last_sign_in_at || null,
        email_confirmed_at: user.email_confirmed_at || null,
        nudge_count: nudge ? Number(nudge.nudge_count) || 0 : 0,
        nudged_at: nudge ? nudge.nudged_at : null,
        opted_out: nudge ? nudge.opted_out === true : false
      };
    })
    .sort((left, right) => {
      const leftTime = Date.parse(left.created_at || '') || 0;
      const rightTime = Date.parse(right.created_at || '') || 0;
      return leftTime - rightTime || left.id.localeCompare(right.id);
    });
}

module.exports = {
  AUTH_PAGE_SIZE,
  TABLE_PAGE_SIZE,
  listAllAuthUsers,
  listAllRows,
  listIncompleteUsers
};
