'use strict';

// external deps
var commander = require('commander');
var config = require('config');
var moment = require('moment');
var Sequelize = require('sequelize');

// internal deps
var ModelClass = require('./lib/model.js');
var plaid = require('./lib/plaid-wrapper.js');

var APP_DB_STRING = config.get("DB_STRING");

var sequelize = new Sequelize(APP_DB_STRING);
sequelize.sync();

// Initialize Models
var Models = new ModelClass(sequelize);

// initialize commands
initCommands();

function initCommands() {

  commander
    .command('fetch [numDays] [userId]')
    .description(
      `Fetch all transactions (and update all accounts info)
      in the past numDays for the given user.
      numDays defaults to 30
      userId defaults to 1`)
    .action(function(numDays, userId) {
      // https://support.plaid.com/customer/portal/articles/2530257
      // this is how much each bank stores
      let user = parseIntOrDefault(userId, 1);
      let daysI = parseIntOrDefault(numDays, 30);
      fetch(user, daysI);
  });

  commander
    .command('fetchAccounts [userId]')
    .description(
      `Retrieve and update all accounts info for the user
      userId defaults to 1`)
    .action(function(userId) {
      let user = parseIntOrDefault(userId, 1);
      let tokensPromise = getAllAccessTokens(user);
      tokensPromise.then(fetchAccounts);
    });

  commander
    .command('updateItemInfo [userId]')
    .action(function(userId) {
      let user = parseIntOrDefault(userId, 1);
      let tokensPromise = getAllAccessTokens(user);
      tokensPromise.then((tokens) => {
        return plaid.getItems(tokens)
      }).then((resp) => {
        resp.map((item) => {
          let itemId = item.item.item_id;
          let instId = item.item.institution_id;
          plaid.getInstitutionById(instId)
          .then((inst) => {
            let name = inst.institution.name;
            return Models.Item.update({
              "institutionId": instId,
              "institutionName": name
            },
            {
              "where": {
                "id": itemId
              }
            })
          }).then(console.log.bind(console))
          .catch((e) => {
            console.log("Failed for ", itemId, instId);
            console.log(e);
          })
        });
      });
    });

  commander
    .command('balance [userId]')
    .description(
      `Retrieve the balance for all checkings/savings accounts.
      And add it as a data point to the balance table.
      userId defaults to 1`
    )
    .action(function(userId) {
      let user = parseIntOrDefault(userId, 1);
      let tokensPromise = Models.Item.findAll({
        include: [{
          model: Models.Account,
          where: {
            $or: [
              {type: 'depository'},
              {type: 'other'}
            ]
          }
        }],
        where: {
          userId: user
        },
      });
      tokensPromise.then(function(items) {
        let tokens = items.map((item) => {
          return item.accessToken;
        });
        return plaid.getAccounts(tokens);
      }).then((accounts) => {
        let balances = accounts.map((account) => {
          return {
            dateOf: new Date(),
            accountId: account.id,
            balance: account.balance
          }
        });
        return Models.BalanceHistory.bulkCreate(balances)
      }).then((models) => {
        console.log("Succesfully wrote balances: ", models.length);
      })
      .catch(console.log.bind(console));
    });

  commander.parse(process.argv);
}

function getAllAccessTokens(userId) {
  let tokensPromise = Models.Item.findAll({
    where: {
      userId: userId
    }
  }).then((items) => {
    let accessTokens = items.map((anItem) => anItem.accessToken);
    console.log(accessTokens);
    return accessTokens;
  });
  return tokensPromise;
}

function fetch(userId, days) {
  var tokensPromise = getAllAccessTokens(userId);

  // update accounts records
  tokensPromise.then(fetchAccounts);
  tokensPromise.then((tokens) => {
    return fetchTransactions(tokens, days)
  });
}

function fetchAccounts(itemTokens) {
  return plaid.getAccounts(itemTokens)
  .then((accounts) => {
    console.log(accounts);
    return Models.Account.bulkCreate(accounts, {
      ignoreDuplicates: true
    });
  }).then((rows) => {
    return rows;
  }).catch(function(err) {
    console.log(err);
  });
}

function fetchTransactions(itemTokens, days) {
  return plaid.getTransactionsPastNDays(itemTokens, days)
    .then(function({startDate, endDate, transactions}) {
      let promises = transactions.map((transaction) => {
        return Models.Transaction.upsert(transaction);
      });
      return promises;
    }).then(function(createdBooleanList) {
      return Promise.all(createdBooleanList)
    }).then(function(createdBooleanList) {
      console.log(createdBooleanList);
      let totalCreated = createdBooleanList.reduce(
          (sum, value) => sum + (value ? 1 : 0), 0);
      console.log("Number of transactions upserted: ",
          createdBooleanList.length);
      console.log("Number of transactions explicitly created: ",
          totalCreated);
    });
}

function parseIntOrDefault(str, def) {
  let int= Number.parseInt(str, 10);
  return Number.isNaN(int) ? def : int;
}

