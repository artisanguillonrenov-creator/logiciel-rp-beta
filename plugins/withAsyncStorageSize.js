// AsyncStorage est limité à 6 Mo sur Android : au-delà, les parties ne
// s'enregistrent plus (SQLITE_FULL). La limite passe à 2 Go.
const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withAsyncStorageSize(config, tailleMo = 2048) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === 'AsyncStorage_db_size_in_MB'));
    cfg.modResults.push({ type: 'property', key: 'AsyncStorage_db_size_in_MB', value: String(tailleMo) });
    return cfg;
  });
};
