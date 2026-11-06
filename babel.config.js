module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Drizzle's drizzle/migrations.js imports the .sql files: this plugin inlines them as text.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
