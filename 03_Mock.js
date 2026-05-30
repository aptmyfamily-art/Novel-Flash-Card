function Mock_user_() {
  return {
    id: 'preview-admin',
    username: 'preview',
    full_name: 'Preview Mode',
    email: '',
    phone: '',
    role: 'admin',
    position: 'Prototype',
    photo_url: '',
    is_active: true
  };
}

function Mock_settings_() {
  return Object.assign({}, SETTINGS_DEFAULTS, {
    org_name: APP.NAME,
    show_demo_users: 'no'
  });
}

function Mock_bootstrap_() {
  const me = Mock_user_();
  return {
    me: me,
    caps: CAPS[me.role] || [],
    app: {
      name: APP.NAME,
      short: APP.SHORT,
      title: APP.TITLE,
      version: APP.VERSION,
      last_updated: APP.LAST_UPDATED,
      description: APP.DESCRIPTION,
      org: APP.ORG,
      logo_icon: APP.LOGO_ICON
    },
    dev: APP.DEV,
    has_users: false,
    settings: Mock_settings_(),
    roles: ROLE_LABEL,
    statuses: STATUS_LABEL,
    preview_mode: true
  };
}

function Mock_login_() {
  const user = Mock_user_();
  return {
    token: 'preview-token',
    user: user,
    caps: CAPS[user.role] || []
  };
}

function Mock_logout_() {
  return { ok: true };
}
