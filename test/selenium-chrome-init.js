var fse = require('fs-extra');

try {
  if (!fse.existsSync('/etc/chromium/policies/managed/test_policy.json')) {
    fse.mkdirsSync('/etc/chromium/policies/managed');
    fse.mkdirsSync('/etc/chromium/policies/recommended');
    fse.writeJSONSync('/etc/chromium/policies/managed/test_policy.json', { 'DefaultNotificationsSetting': 1 });
  }
} catch (e) {
  if (e.code === 'EACCES') {
    console.error('You might need to run this script with sudo.');
  }
  throw e;
}
