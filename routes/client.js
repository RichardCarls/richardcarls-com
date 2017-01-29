const path = require('path')
const qs = require('querystring')

const winston = require('winston')
const axios = require('axios').create()
const router = require('express').Router() // eslint-disable-line new-cap
const bodyParser = require('body-parser')
const csurf = require('csurf')
const _ = require('lodash')

const app = require(path.resolve(process.env.APP_ROOT, './app'))

router
  .use(bodyParser.urlencoded({ extended: true }))
  .use(csurf())

const client = {
  responseTypes: [
    // RSVP
    { name: 'Reply', value: 'in-reply-to' },
    { name: 'Repost', value: 'repost-of' },
    { name: 'Like', value: 'like-of' },
    { name: 'Bookmark', value: 'bookmark-of' },
    { name: 'Tag', value: 'tag-of' }
  ]
}

router.get('/', (req, res) => {
  client.responseTypes.forEach(type => {
    if (req.query[type.value]) {
      client.currentResponseType = type.value
    }
  })

  return res.render('client/client.nunj.html', {
    site: app.locals.site,
    profile: app.locals.profile,
    user: req.user,
    client: _.assign(client, req.query),
    session: req.session,
    _csrf: req.csrfToken()
  })
})

router.post('/update/:property', (req, res) => {
  if (!req.user) {
    return res.redirect(req.baseUrl)
  }

  switch (req.params.property) {
    case 'endpoint':
      let config
      let endpoint

      if (req.body.endpoint === 'other') {
        endpoint = req.body['endpoint-other']
      } else {
        endpoint = req.body.endpoint
      }

      // Update the user's preferred endpoint and fetch config
      if (req.session.preferredEndpoint !== endpoint) {
        req.session.preferredEndpoint = endpoint

        axios.get(endpoint, {
          params: {
            q: 'config'
          }
        })
          .then(response => {
            try {
              config = JSON.parse(response.data)
            } catch (err) {
              config = {}
            }

            req.session.config = config

            return res.redirect(req.baseUrl)
          })
          .catch(err => winston.error(err))
      }
      break

    case 'responseType':
      const type = req.body.responseType

      return res.redirect(`${req.baseUrl}?${type}[]`)
  }
})

router.post('/post', (req, res) => {
  // Format categories
  req.body.category = req.body.category
    .split(/[\s,]+/)

  delete req.body._csrf

  // Post to user's micropub endpoint
  axios
    .post(req.session.preferredEndpoint, qs.stringify(req.body), {
      headers: {
        Authorization: `Bearer ${req.user.token}`
      }
    })
    .then(response => {
      return res.redirect(response.headers.location)
    })
    .catch(err => {
      winston.error(err)

      return res.redirect(req.baseUrl + '#failed')
    })
})

router.get('/preview', (req, res) => {
  return res.end('Preview not loaded')
})

router.post('/preview', (req, res) => {
  // Format categories
  req.body.category = req.body.category
    .split(/[\s,]+/)

  delete req.body._csrf

  // Post to user's micropub endpoint
  axios.post(req.session.config.preview, {
    headers: {
      Authorization: `Bearer ${req.user.token}`
    },
    data: req.body
  })
    .then(({ data }) => res.status(200).end(data))
    .catch(err => winston.error(err))
})

module.exports = router
