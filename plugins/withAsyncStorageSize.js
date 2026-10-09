// Android AsyncStorage impose un maximum natif exprimé en Mo ; il n'existe
// pas de valeur 'illimité'. Les données croissantes passent dans la base
// SQLite dédiée. Cette marge de 256 Go est supérieure au disque de la
// tablette et laisse RKStorage aux petites préférences et aux migrations.
const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withAsyncStorageSize(config, tailleMo = 262144) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === 'AsyncStorage_db_size_in_MB'));
    cfg.modResults.push({ type: 'property', key: 'AsyncStorage_db_size_in_MB', value: String(tailleMo) });
    return cfg;
  });
};
