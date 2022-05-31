import express from 'express'
import { fontsPath, themes } from './constants'
import * as fs from 'fs'
import * as pfs from 'fs/promises'
import * as path from 'path'
import { fabric } from 'fabric'
import { Text } from 'fabric/fabric-impl'
import { josa } from 'josa'
import { registerFont } from 'canvas'
import jwt from 'jsonwebtoken'

registerFont(path.join(fontsPath, 'NotoSansKR-Bold.otf'), {
    family: 'Noto Sans KR',
})
registerFont(path.join(fontsPath, 'UbuntuMono-Regular.ttf'), {
    family: 'Ubuntu Mono',
})
registerFont(path.join(fontsPath, 'SpoqaHanSansNeo-Bold.ttf'), {
    family: 'Spoqa Han Sans Neo',
})
registerFont(path.join(fontsPath, 'KoPubWorld Dotum Bold.ttf'), {
    family: 'KoPubWorldDotum',
})

process.on('uncaughtException', console.error)
process.on('unhandledRejection', console.error)

const config = require('../config.json')

if (process.env.PORT) {
    config.port = process.env.PORT
}

if (process.env.JWT_TOKEN) {
    config.token = process.env.JWT_TOKEN
}

const themesDir = path.join(__dirname, '../skins')

const urlRegex = /^data:.+\/(.+);base64,(.*)$/

Promise.all(
    fs.readdirSync(themesDir).map(async (x) => {
        const rarities = await pfs.readdir(path.join(themesDir, x))
        // console.log(rarities)
        let res = []
        for (const rarity of rarities) {
            const module = require(path.join(themesDir, x, rarity))
            res.push({
                rarity: path.basename(rarity).split('.').shift(),
                data: module,
            })
        }
        themes.push({
            name: x,
            rarities: res,
        })
    }),
).then(() => {
    const app = express()

    app.get('/fish/:theme/:token', async (req, res) => {
        let query: any
        try {
            query = jwt.verify(req.params.token, config.token)
        } catch (e) {
            return res.json({ error: 'Invalid token' })
        }
        // const query = req.query
        const { theme: themeName } = req.params

        const theme = themes.find((x) => x.name === themeName)

        if (!theme) return res.json({ message: 'invalid theme' })

        const rarity = theme.rarities.find(
            (x: any) => x.rarity === query.rarity,
        )

        if (!rarity) return res.json({ message: 'Unknown rarity.' })

        const canvas = new fabric.StaticCanvas(null, {
            width: rarity.data.width,
            height: rarity.data.height,
        })

        canvas.loadFromJSON(rarity.data.canvasData, () => {
            canvas.getObjects('text').forEach((value) => {
                const text = value as Text
                for (const [k, v] of Object.entries(query)) {
                    text.text = text.text!.split(`{${k}}`).join(v as string)
                }
                text.text = josa(text.text!)
            })
            canvas.getObjects('textbox').forEach((value) => {
                const text = value as Text
                for (const [k, v] of Object.entries(query)) {
                    text.text = text.text!.split(`{${k}}`).join(v as string)
                }
                text.text = josa(text.text!)
            })
            canvas.renderAll()
            res.setHeader('Content-Type', 'image/png')
            const url = canvas.toDataURL()
            const matches = url.match(urlRegex)!
            const data = matches[2]
            const buffer = Buffer.from(data, 'base64')
            res.send(buffer)
        })
    })

    app.listen(config.port, () => console.log('와아 서버 시작!'))
})
