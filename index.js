'use strict';

// external deps
var config = require('config');
var express = require('express');
var bodyParser = require('body-parser');
var Sequelize = require('sequelize');
var mustacheExpress = require('mustache-express');

// internal deps
var ModelClass = require('./lib/model.js');
var plaidClient = require('./lib/plaid-wrapper.js');

var APP_PORT = config.get('PLAID.APP_PORT');
var PLAID_PUBLIC_KEY = config.get('PLAID.PUBLIC_KEY');
var PLAID_ENV = config.get('PLAID.ENV');
var APP_DB_STRING = config.get("DB_STRING");

var sequelize = new Sequelize(APP_DB_STRING);
sequelize.sync();

// Initialize Models
var Models = new ModelClass(sequelize);

var app = express();
app.use(express.static('public'));
app.set('view engine', 'mustache');
app.engine('mustache', mustacheExpress());

app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());

app.get('/', function(request, response) {
  Models.User.findAll()
  .then((users) => {
    console.log(users.map((user) => user.toJSON()));
    response.render('user-select.mustache', {
      PLAID_PUBLIC_KEY: PLAID_PUBLIC_KEY,
      PLAID_ENV: PLAID_ENV,
      users: users.map((user) => user.toJSON())
    });
  })
});

app.param("user", function(req, res, next, id) {
  Models.User.findById(id)
  .then((user) => {
    req.user = user;
    next();
  }).catch((err) => {
    console.log(err);
    next(err);
  });
});

app.get('/user/:user', function(req, res) {
  Models.Item.findAll()
  .then(items => {
    return Promise.all(items.map(item => {
      return plaidClient.validateItem(item.accessToken)
      .then(valid => {
        let publicToken = Promise.resolve(false);
        if (!valid) {
          publicToken =
            plaidClient.createPublicToken(item.accessToken)
        }
        return publicToken;
      }).then(publicToken => ({
        institution: item.institutionName,
        publicToken: publicToken.public_token 
      })).catch(e => {
        console.log("Unexpected failure to create publicToken",
            item.toJSON());
        console.log(e);
        return {
          institution: item.institutionName,
          error: true
        };
      });
    }));
  }).then(items => {
    res.render('index.mustache', {
      userId: req.user.id,
      displayName: req.user.displayName,
      PLAID_PUBLIC_KEY: PLAID_PUBLIC_KEY,
      PLAID_ENV: PLAID_ENV,
      items: items
    });

  })
});

app.get('/user/:user/transactions/:page?', function(req, res) {
  const itemsPerPage = 30;
  const order = ['dateOf', 'DESC']; // default to get latest
  let page = 0;
  if (req.params.page) {
    page = Number.parseInt(req.params.page, 10)
  }
  let offset = page*itemsPerPage;
  Models.Transaction.findAll({
    order: [order],
    offset,
    limit: itemsPerPage,
    include: [{
      model: Models.Account,
      include: [{
        model: Models.Item,
        where: {
          userId: Number.parseInt(req.params.user, 10)
        } 
      }]
    }]
  }).then(balances => {
    res.json(balances);
  });
});

app.get("/users", function(req, res) {
  Models.User.findAll()
  .then((users) => {
    res.json(users);
  });
});
app.put("/user", function(req, res) {
  console.log(req.body);
  Models.User.max('id')
  .then((id) => {
    if (!Number.isInteger(id)) {
      id = 0;
    }
    return Models.User.create({
      displayName: req.body.displayName,
      id: id+1
    });
  }).then((result) => {
    res.json(result.toJSON());
  });
});

app.delete("/user", function(req, res) {
  let id = Number.parseInt(req.body.id, 10);
  if (Number.isNaN(id)) {
    console.error("Bad id: ", req.body.id);
    return res.status(400).json({error: true});
  }
  Models.User.destroy({
    where: {
      id: id
    }
  }).then((row) => {
    res.json(row);
  });
});

app.get("/items", function(req, res) {
  Models.Item.findAll()
  .then((items) => {
    res.json(items);
  });
});

app.put("/item", function(req, res) {
  let publicToken = req.body.publicToken;
  let userId = req.body.userId;
  let instName = req.body.institutionName;
  let instId = req.body.institutionId;
  console.log("/item: ", publicToken, userId, instName, instId);
  plaidClient.exchangePublicToken(publicToken, function(error, tokenResponse) {
    console.log("/item: ", publicToken, userId, tokenResponse, error);
    if (error != null) {
      var msg = 'Could not exchange public_token!';
      console.log(msg + '\n' + error);
      return response.json({
        error: msg
      });
    }
    Models.Item.create({
      id: tokenResponse.item_id,
      accessToken: tokenResponse.access_token,
      userId: userId,
      institutionName: instName,
      institutionId: instId
    }).then((result) => {
      res.json(result);
    });
  });
});

app.delete("/item", function(req, res) {
  Models.Item.destroy({
    where: {
      id: req.body.id
    }
  }).then((row) => {
    res.json(row);
  });
});

var server = app.listen(APP_PORT, function() {
  console.log('Account Set Up listening on ' + APP_PORT);
});
