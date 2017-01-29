const path = require('path')
const qs = require('querystring')

const _ = require('lodash')
const winston = require('winston')
const router = require('express').Router()
const bearerToken = require('express-bearer-token')
const axios = require('axios')

const micropub = require('connect-micropub')
const webmentions = require('webmentions')
const indieutil = require('@rcarls/indieutil')

const app = require(path.resolve(process.env.APP_ROOT, './app'))
const Note = require(path.resolve(process.env.APP_ROOT, './models/note'))
const NoteContext = require(path.resolve(
  process.env.APP_ROOT, './models/note-context'))
const Person = require(path.resolve(
  process.env.APP_ROOT, './models/person'))

router.get('', micropub.query({
  config: {
    feed: `${app.locals.site.url}/notes`,
    preview: `${app.locals.site.micropubEndpoint}/preview`
  }
}))

// TODO: move preview rendering to connect-micropub
router.post('/preview', micropub.create({
  jf2: {
    preferredContentType: 'text/plain',
    implicitContentType: false,
    compact: false,
    references: 'embed'
  }
}), (req, res) => {
  indieutil
    .jf2FetchRefs(req.micropub, {
      jf2: {
        preferredContentType: 'text/plain',
        implicitContentType: false,
        compact: false,
        references: 'embed'
      },
      embedReferences: true,
      determinePostTypes: true
    })
    .then(jf2 => {
      return res.render('note-preview.nunj.html', {
        note: new Note(jf2)
      })
    })
    .catch(err => {
      winston.error(err)

      return res
        .status(500)
        .send()
    })
})

router.use(bearerToken(), (req, res, next) => {
  if (!req.token) {
    winston.warn('No token')
    return res
      .status(400)
      .end('Authorization token required')
  }

  axios.get(app.locals.site.tokenEndpoint, {
    headers: {
      Authorization: `Bearer ${req.token}`
    }
  }).then(response => {
    const data = qs.parse(response.data)

    // Check scope
    if (!data.scope) {
      throw new TypeError('missing scope paramer')
    }

    const hasScope = data.scope
          .split(' ')
          .some(scope => /(?:create|post)/.test(scope))

    if (!hasScope) {
      throw new TypeError('missing create or post scope')
    }

    // Check client ID
    // TODO

    return next()
  }).catch(err => {
    winston.error(err)

    return next(err)
  })
})

router.post('', micropub.create({
  jf2: {
    preferredContentType: 'text/plain',
    implicitContentType: false,
    compact: false,
    references: false
  }
}), (req, res) => {
  indieutil.jf2FetchRefs(req.micropub, {
    jf2: {
      preferredContentType: 'text/plain',
      implicitContentType: 'text/plain',
      compact: false
    },
    determinePostTypes: true
  }).then(jf2 => {
    jf2.published = new Date()

    winston.debug('pre-tasks', jf2)

    let note = new Note(jf2)

    // Check for target property reference
    if (!jf2.references[note._replyContext[0]]) {
      jf2.references[note._replyContext[0]] = {}
    }

    const saveTasks = Object.keys(jf2.references).map(url => {
      const ref = jf2.references[url]

      if (!_.isEmpty(ref)) {
        return update(url, ref)
      } else {
        return scrape(url, ref)
      }
    })

    delete jf2.references

    return Promise.all(saveTasks)
      .then(refs => note.save())
      .then(note => {
        winston.info(`created new ${note._postTypes[0]}`, note.url)

        res
          .status(200)
          .location(note.url)
          .send()

        // Send webmentions
        note._mentionTargets.forEach(target => {
          // TODO: develop indieutil solution
          webmentions.proxyMention({
            source: note.url,
            target: target
          }, (err, data) => {
            if (err) {
              return winston.warn(err)
            }
          })
        })
      })
  }).catch(err => {
    winston.error(err)

    return res.status(500).end()
  })
})

function update (url, ref) {
  winston.debug('ref', ref)

  if (ref.type === 'cite') {
    // TODO: Set uid in toJf2 or fetch
    if (!ref.uid) {
      ref.uid = Array.isArray(ref.url) ? ref.url[0] : ref.url
    }

    if (ref.uid !== url) {
      // TODO: Opt to update target property instead
      return Promise.reject(new Error('URLs do not match'))
    }

    // TODO: jf2FetchRefs - customize postTypes key
    ref._postTypes = [].concat(ref.postTypes)

    return NoteContext
      .findOne({ _id: ref.uid })
      .exec()
      .then(context => {
        if (!context) {
          return new NoteContext(ref)
            .save()
            .then(context => {
              winston.info(`Saved new note context ${context.uid}`)

              return context
            })
        }

        return context
      })
  }

  if (ref.type === 'card') {
    // TODO: Set uid in toJf2 or fetch
    if (!ref.uid) {
      ref.uid = Array.isArray(ref.url) ? ref.url[0] : ref.url
    }

    if (ref.uid !== url) {
      // TODO: Opt to update target property instead
      return Promise.reject(new Error('URLs do not match'))
    }

    return Person
      .findOne({ _id: ref.uid })
      .exec()
      .then(person => {
        if (!person) {
          return new Person(ref)
            .save()
            .then(person => {
              winston.info(`Saved new person ${person.uid}`)

              return person
            })
        }

        return person
      })
  }
}

function scrape (url, ref) {
  winston.warn('Default reference handler', url)

  return {
    type: 'cite',
    url: url
  }

  /*
  const x = require('x-ray')()

  return new Promise(function (resolve, reject) {
    x(url, {
      meta: {
        title: 'title',
        description: 'meta[name="description"]@content',
        summary: 'meta[name="summary"]@content',
        abstract: 'meta[name="abstract"]@content',
        revised: 'meta[name="revised"]@content',
        author: x('meta[name="author"]', {
          name: '@content|split:","[0]|trim',
          email: '@content|split:","[1]|trim'
        }),
        'reply-to': 'meta[name="reply-to"]@content',
        date: 'meta[name="date"]@content'
      },
      rels: x('head > link', {
        me: '[rel="me"]@href',
        shortlink: '[rel="shortlink"]@href',
        bookmark: x('[rel="bookmark"]', {
          title: '@title',
          href: '@href'
        }),
        canonical: '[rel="canonical"]@href',
        logo: '[rel="logo"]@href'
      }),
      og: {
        type: 'meta[property="og:type"]@content',
        title: 'meta[property="og:title"]@content',
        url: 'meta[property="og:url"]@content',
        description: 'meta[property="og:description"]@content',
        site_name: 'meta[property="og:site_name"]@content',
        image: {
          value: 'meta[property="og:image"]@content',
          url: 'meta[property="og:image:url"]@content',
          secure_url: 'meta[property="og:image:secure_url"]@content',
          type: 'meta[property="og:image:type"]@content'
        },
        video: {
          value: 'meta[property="og:video"]@content',
          url: 'meta[property="og:video:url"]@content',
          secure_url: 'meta[property="og:video:secure_url"]@content',
          type: 'meta[property="og:video:type"]@content'
        },
        audio: {
          value: 'meta[property="og:audio"]@content',
          url: 'meta[property="og:audio:url"]@content',
          secure_url: 'meta[property="og:audio:secure_url"]@content'
        },
        article: {
          published_time: 'meta[property="og:article:published_time"]@content',
          modified_time: 'meta[property="og:article:modified_time"]@content',
          author: 'meta[property="og:article:author"]@content'
        },
        profile: {
          first_name: 'meta[property="og:profile:first_name"]@content',
          last_name: 'meta[property="og:profile:last_name"]@content'
        }
      },
      twitter: {
        site: 'meta[name="twitter:site"]@content',
        creator: 'meta[name="twitter:creator"]@content',
        title: 'meta[name="twitter:title"]@content',
        description: 'meta[name="twitter:description"]@content',
        image: {
          url: 'meta[name="twitter:image"]@content',
          alt: 'meta[name="twitter:image:alt"]@content'
        }
      }
    })((err, { meta, rels, og, twitter }) => {
      if (err) {
        winston.warn(err)
        return reject(err)
      }

      winston.debug('scrape', { meta, rels, og, twitter })

      const author = {
        type: 'card'
      }

      // Name
      author.name = (_.get(og, 'profile.first_name') +
                     _.get(og, 'profile.last_name') + '').trim()
      author.name = author.name || _.get(meta, 'author.name')
      author.name = author.name || _.get(og, 'site_name')
      if (!author.name) {
        author.name = author.name || url
      }

      // URL
      author.url = _.get(rels, 'me') || _.get(og, 'article.author')
      if (!author.url) {
        const authorUrl = require('url').parse(url)
        author.url = `${authorUrl.protocol}//${authorUrl.host}`
      }
      author.uid = author.url
      author.url = [author.url]

      // Photo
      let authorPhoto = _.get(rels, 'logo')
      if (authorPhoto) {
        author.photo = [authorPhoto]
      }

      const cite = {
        type: 'cite',
        uid: url,
        url: [url]
      }

      // Name
      cite.name = _.get(og, 'title') || _.get(twitter, 'title')
      cite.name = cite.name || (_.get(meta, 'title') + '')
        .split('|')[0].trim()

      // Content
      let content = _.get(og, 'description') || _.get(twitter, 'description')
      content = content || _.get(meta, 'description')
      content = content || _.get(meta, 'summary')
      content = content || _.get(meta, 'abstract')
      if (content) {
        cite.content = content
      }

      // Published
      let published = _.get(og, 'article.published_time')
      published = published || _.get(meta, 'date')
      published = published || _.get(og, 'article.modified_time')
      published = published || _.get(meta, 'revised')
      if (published) {
        cite.published = published
      }

      // Author
      cite.author = author.uid

      // Accessed
      cite.accessed = new Date()

      return resolve(Promise.all([
        update(author.uid, author),
        update(cite.uid, cite)
      ]))
    })
  })
  */
}

module.exports = router
