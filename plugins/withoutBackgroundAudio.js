const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withoutBackgroundAudio(config) {
  return withInfoPlist(config, (mod) => {
    const modes = mod.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      const kept = modes.filter((m) => m !== 'audio');
      if (kept.length > 0) mod.modResults.UIBackgroundModes = kept;
      else delete mod.modResults.UIBackgroundModes;
    }
    return mod;
  });
};
