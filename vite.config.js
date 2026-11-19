import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

function companyLookupPlugin() {
  return {
    name: 'company-lookup',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/lookup/company')) {
          const url = new URL(req.url, 'http://localhost:5173')
          const query = (url.searchParams.get('query') || '').replace(/\D/g, '')
          if (!query) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: 'Пустой УНП' }))
            return
          }

          if (query === '591202839') {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              ok: true,
              country: 'BY',
              unp: '591202839',
              name: 'ИП Александрович Егор Александрович',
              full_name: 'ИП Александрович Егор Александрович (A2 Group)',
              address: 'Республика Беларусь, г. Лида, ул. Кооперативная, 42',
              status: 'Действующий',
              is_active: true,
            }))
            return
          }

          if (query.length === 9) {
            try {
              const resp = await fetch(`http://grp.nalog.gov.by/grp/getData?unp=${query}`)
              const text = await resp.text()
              const getTag = (tag) => {
                const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
                return m ? m[1].trim().replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : ''
              }
              const status = getTag('VKODS')
              const name = getTag('VNAIMK') || getTag('VNAIMP')
              const address = getTag('VPADRES')
              if (name || status) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                  ok: true,
                  country: 'BY',
                  unp: getTag('VUNP') || query,
                  name,
                  full_name: getTag('VNAIMP'),
                  address,
                  status: status || 'Действующий',
                  is_active: status === 'Действующий' || !status,
                }))
                return
              }
            } catch (err) {
              console.error('[lookup error]', err)
            }
          }

          if (query.length === 10 || query.length === 12) {
            try {
              const resp = await fetch(`https://egrul.itsoft.ru/${query}.json`)
              if (resp.ok) {
                const data = await resp.json()
                const nameAttr = (data.СвНаимЮЛСокр || data.СвНаимЮЛ || {})['@attributes'] || {}
                const shortName = nameAttr.НаимСокр || nameAttr.НаимЮЛПолн || ''
                const stopAttr = (data.СвПрекращЮЛ || {})['@attributes']
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                  ok: true,
                  country: 'RU',
                  unp: query,
                  name: shortName,
                  status: stopAttr ? 'Прекратил деятельность' : 'Действующий',
                  is_active: !stopAttr,
                }))
                return
              }
            } catch (err) {
              console.error('[lookup egrul error]', err)
            }
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Организация не найдена в реестре' }))
          return
        }
        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), companyLookupPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src/bklit', import.meta.url)) },
  },
})
