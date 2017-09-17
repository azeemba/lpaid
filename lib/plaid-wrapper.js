'use strict';

// external deps
var config = require('config');
var plaid = require('plaid');
var moment = require('moment');

var PLAID_CLIENT_ID = config.get('PLAID.CLIENT_ID');
var PLAID_SECRET = config.get('PLAID.SECRET');
var PLAID_PUBLIC_KEY = config.get('PLAID.PUBLIC_KEY');
var PLAID_ENV = config.get('PLAID.ENV');

// Initialize the Plaid client
var client = new plaid.Client(
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  PLAID_PUBLIC_KEY,
  plaid.environments[PLAID_ENV]
);

const SIMULTANEOUS_REQS = 3;

exports.getItems = (accessTokens) => {
  let promises = accessTokens.map((token) => {
    return client.getItem(token);
  }, {concurrency: SIMULTANEOUS_REQS});
  return Promise.all(promises);
}

exports.validateItem = (accessToken) => {
  return client.getAccounts(accessToken)
    .then(() => true)
    .catch((e) => {
      console.log("Looks like item is unlinked");
      console.log(e);
      return false;
    });
}

exports.createPublicToken = client.createPublicToken.bind(client);
exports.getInstitutionById = client.getInstitutionById.bind(client);
exports.exchangePublicToken = client.exchangePublicToken.bind(client);
exports.getAccounts = (accessTokens) => {
  // given a list of accessTokens (for multiple items)
  // retrieve all accounts
  let promises = accessTokens.map((accessToken) => {
    console.log("Getting accounts: ", accessToken);
    return client
      .getAccounts(accessToken)
      .then((response) => {
        let accounts = response.accounts;
        let instId = response.item.institution_id;
        let itemId = response.item.item_id;

        // massage to be our model friendly
        accounts.forEach(account => {
          account.institutionId = instId;
          account.id = account.account_id;
          account.balance = account.balances.current;
          account.itemId = itemId;
        });
        return accounts;
      });
  }, {concurrency: SIMULTANEOUS_REQS});

  return Promise
    .all(promises)
    .then((listOfAccounts) => {
      let accounts = [];

      // flatten listOfAccoutns array
      // [ [acct1, acct2], [acct3] ] -> [ acct1, acct2, acct3 ]
      listOfAccounts.forEach((cur_accounts) => {
        accounts = accounts.concat(cur_accounts);
      });

      return accounts;
    });
};

exports.getTransactionsFromTo = (accessTokens, fromDate, toDate) => {
  let promises = accessTokens.map((accessToken) => {
    console.log("Getting transactiosn for: ", accessToken);
    return client
    .getTransactions(accessToken, fromDate, toDate)
    .then((response) => {
      let transactions = response.transactions;
      transactions.forEach(function(transaction) {
        transaction.id = transaction.transaction_id;
        transaction.accountId = transaction.account_id;
        // convert dollars to cents
        transaction.amount = Math.round(transaction.amount*100);
        transaction.categoryId = transaction.category_id;
        transaction.categories = JSON.stringify(transaction.category);
        transaction.dateOf = transaction.date;
        transaction.location = JSON.stringify(transaction.location);
      });
      return transactions;
    });
  }, {concurrency: SIMULTANEOUS_REQS});

  return Promise
    .all(promises)
    .then((listOfTs) => {
      let ts = [];

      // flatten listOfAccoutns array
      // [ [acct1, acct2], [acct3] ] -> [ acct1, acct2, acct3 ]
      listOfTs.forEach((curTran) => {
        ts = ts.concat(curTran);
      });

      return {
        fromDate: fromDate,
        toDate: toDate,
        transactions: ts
      };
    });
}

exports.getTransactionsPastNDays = (accessTokens, days) => {
  // given a list of accessTokens (for multiple items)
  // retrieve all transactions
  const now = moment();
  const today = now.format('YYYY-MM-DD');
  const nDays = now.subtract(days, 'days').format('YYYY-MM-DD');

  return this.getTransactionsFromTo(accessTokens, nDays, today);
}
