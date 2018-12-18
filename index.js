const _ = require('lodash')
const fs = require('fs')

class I18nPlugin {
  constructor (master, options) {
    console.log(`Initializing I18n... master: '${master}'`)

    this.master = master
    this.path = options.path
    this.supportedLocales = options.supportedLocales || []
    this.fallbacks = options.fallbacks || {}
  }

  apply (compiler) {
    compiler.plugin('emit', (compilation, callback) => {
      console.log('Supported locales: ', this.supportedLocales)

      console.log(`Merging locales with their fallbacks...`)

      this.supportedLocales.forEach(locale => {
        compilation.fileDependencies.add(`${this.path}/${locale}.json`)

        let mergedObject

        // Build fallback chain for non master locales
        if (locale !== this.master) {
          let currentFallbackLocale = locale
          let fallbackChain = [locale]

          while (currentFallbackLocale !== this.master) {
            currentFallbackLocale = this.fallbacks[currentFallbackLocale]
            fallbackChain.push(currentFallbackLocale)
          }

          console.log(`Locale fallbacks for ${locale} ->`, fallbackChain)

          mergedObject = fallbackChain.reverse().reduce((memo, fallbackLocale) => {
            const fallbackFilepath = `${this.path}/${fallbackLocale}.json`

            const data = JSON.parse(fs.readFileSync(fallbackFilepath, 'utf8'))

            memo = _.merge(memo, data)

            return memo
          }, {})
        } else {
          const masterFilepath = `${this.path}/${this.master}.json`

          mergedObject = JSON.parse(fs.readFileSync(masterFilepath, 'utf8'))
        }

        const filepath = `translations/${locale}.json`
        const content = JSON.stringify(mergedObject)

        compilation.assets[filepath] = {
          source: () => { return Buffer.from(content) },
          size: () => { return Buffer.byteLength(content) }
        }
      })

      callback()
    })
  }
}

module.exports = I18nPlugin
