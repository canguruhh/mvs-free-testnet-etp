import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import * as requestify from 'requestify'
import * as rq from 'request-promise'

const ENDPOINT = (functions.config().mvsd) ? functions.config().mvsd.endpoint : "https://testnet.mvs.org/rpc/v3"
const RECAPTCHA_SECRET = (functions.config().recaptcha) ? functions.config().recaptcha.secret : ""
const ACCOUNT_NAME = (functions.config().mvsd) ? functions.config().mvsd.account : "user"
const ACCOUNT_AUTH = (functions.config().mvsd) ? functions.config().mvsd.password : "password"
const ETP_AMOUNT = (functions.config().settings) ? parseInt(functions.config().settings.amount) : 10000
const HISTORY_COUNT = (functions.config().settings) ? parseInt(functions.config().settings.history) : 25

admin.initializeApp(functions.config().firebase);

const db = admin.firestore()

db.settings({
    timestampsInSnapshots: true
});

export const height = functions.https.onRequest((req, res) => {
    requestify.post(ENDPOINT, {
        jsonrpc: "3.0",
        method: "fetch-height",
        params: []
    })
        .then(response => {
            const result = JSON.parse(response.body).result
            res.set('Cache-Control', 'public, max-age=30, s-maxage=30');
            res.json({height: result})
        })
        .catch(error => {
            res.status(400).json({ message: error.message })
        })
})

export const history = functions.https.onRequest((req, res) => {
    db.collection('transfer').limit(HISTORY_COUNT).get()
        .then(snapshot => {
            const result = []
            snapshot.forEach(doc => {
                const item = doc.data()
                result.push({
                    hash: item.hash,
                    address: item.address,
                    date: item.date.toDate()
                })
            })
            res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
            res.status(200).json(result)
        })
        .catch(error => {
            res.status(400).json({ message: error.message })
        })
})

export const balance = functions.https.onRequest((req, res) => {
    requestify.post(ENDPOINT, {
        jsonrpc: "3.0",
        method: "getbalance",
        params: [ACCOUNT_NAME, ACCOUNT_AUTH]
    })
        .then(response => {
            const result = JSON.parse(response.body).result
            res.set('Cache-Control', 'public, max-age=30, s-maxage=30');
            res.json({ available: result.total_available - result.total_frozen })
        })
        .catch(error => {
            res.status(400).json({ message: error.message })
        })
})

export const send = functions.https.onRequest((req, res) => {
    const captcha = req.body.captcha
    const address = req.body.address
    const email = req.body.email

    console.log("check recaptcha response", captcha)
    rq.post({
        url: 'https://recaptcha.google.com/recaptcha/api/siteverify',
        form: {
            remoteip: req.connection.remoteAddress,
            secret: RECAPTCHA_SECRET,
            response: captcha
        },
        transform: (response: string) => JSON.parse(response)
    })
        .then(result => {
            if (!result.success) throw Error("Recaptcha verification failed. Are you a robot?")
            return db.collection('transfer').where('address', '==', address).get()
                .then(snapshot => {
                    if (!snapshot.empty) throw Error('Address already in history')
                    return;
                })
        })
        .then(() => _send(address, ETP_AMOUNT))
        .then(tx => db.collection("transfer").doc().set({
            email, address, tx, date: new Date(), hash: tx.hash
        }).then(() => res.status(200).json(tx))
        )
        .catch(reason => {
            console.log(reason.message)
            res.status(400).send(reason.message)
        })
})

function _send(address, amount) {
    return requestify.post(ENDPOINT, {
        jsonrpc: "3.0",
        method: "send",
        params: [ACCOUNT_NAME, ACCOUNT_AUTH, address, amount]
    })
        .then(response => JSON.parse(response.body).result)
        .then(tx => {
            if (tx.hash)
                return tx
            throw Error('Unable to send. Possible the wallet needs a recharge.')
        })
        .catch(error => {
            console.error('error sending etp:', error)
            throw Error('error sending etp')
        })
}