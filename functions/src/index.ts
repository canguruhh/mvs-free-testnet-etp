import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import * as requestify from 'requestify'
import * as rq from 'request-promise'
import * as sgMail from '@sendgrid/mail'
import { MailData } from '@sendgrid/helpers/classes/mail';


const ENDPOINT = (functions.config().mvsd) ? functions.config().mvsd.endpoint : "https://testnet.mvs.org/rpc/v3"
const RECAPTCHA_SECRET = (functions.config().recaptcha) ? functions.config().recaptcha.secret : ""
const ACCOUNT_NAME = (functions.config().mvsd) ? functions.config().mvsd.account : "user"
const ACCOUNT_AUTH = (functions.config().mvsd) ? functions.config().mvsd.password : "password"
const ETP_AMOUNT = (functions.config().settings) ? parseInt(functions.config().settings.amount) : 10000
const SENDGRID = {
    api: (functions.config().sendgrid) ? functions.config().sendgrid.api : "",
    template: (functions.config().sendgrid) ? functions.config().sendgrid.template : "",
    asm: (functions.config().sendgrid) ? functions.config().sendgrid.asm : "", //Unsubscibe list
}

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
            res.json({ height: result })
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
        .then(response => JSON.parse(response.body))
        .then(response => {
            if (response.error)
                throw Error(response.error.message)
            const result = response.result
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
    const email: string = req.body.email

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
        .then(tx => {
            res.status(200).json(tx)
            return Promise.all([
                db.collection("transfer").doc().set({
                    address, tx, date: new Date(), hash: tx.hash, amount: ETP_AMOUNT
                }),
                db.collection("user").doc().set({
                    email, address, date: new Date()
                })
            ])
        })
        .then(() => {
            console.info("send mail", SENDGRID.api, SENDGRID.template, SENDGRID.asm)
            sgMail.setApiKey(SENDGRID.api);
            const msg: MailData = {
                from: 'info@mvs.org',
                templateId: SENDGRID.template,
                personalizations: [
                    {
                        to: email,
                        substitutions:{
                            address: address
                        }

                    }
                ],
                asm: {
                    groupId: parseInt(SENDGRID.asm)
                }
            }
            console.info(msg)
            return sgMail.send(msg)
        })
        .catch(reason => {
            console.log(JSON.stringify(reason))
            if (!res.headersSent)
                res.status(400).send(reason.message)
        })
})

function _send(address, amount) {
    return requestify.post(ENDPOINT, {
        jsonrpc: "3.0",
        method: "send",
        params: [ACCOUNT_NAME, ACCOUNT_AUTH, address, amount]
    })
        .then(response => JSON.parse(response.body))
        .then(response => {
            if (response.error)
                throw Error(response.error.message)
            console.log(response)
            if (response.result.hash)
                return response.result
            throw Error('Unable to send.')
        })
}