# webpack-i18n-fallbacks

Webpack plugin to be able to manage all translation files and their fallbacks in build time

`new I18nPlugin(master_language, options)`

*master_language*: master language
*options*: hash with options

## Options

*path*: path pointing to all translation files
*supportedLocales*: list of all supported locales
*fallbacks*: a hash with all the defined fallbacks


### Example

```
new I18nPlugin('es', {
 path: 'src/translations',
 supportedLocales: ['es', 'ca', 'en', 'nl'],
 fallbacks: {
   ca: 'es',
   en: 'es',
   nl: 'en'
 }
})
```
