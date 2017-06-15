'use strict';

var Sequelize = require('sequelize');

// model.js

class Model {
    constructor(sequelize) {
        this._sequelize = sequelize;

        let opts = {
            // we don't want created_at and
            // updated_at columns for all tables
            timestamps: false,
            freezeTableName: true
        };

        this.User = sequelize.define('users', {
            'id': {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoincrement: true,
            },
            'displayName': {
                type: Sequelize.STRING,
                field: 'display_name'
            }
        }, opts);

        this.Item = sequelize.define('items', {
            'id': {
                type: Sequelize.STRING,
                primaryKey: true
            },
            'accessToken': {
                type: Sequelize.STRING,
                field: 'access_token'
            },
            'institutionId': {
                type: Sequelize.STRING,
                field: 'institution_id'
            },
            'institutionName': {
                type: Sequelize.STRING,
                field: 'institution_name'
            },
            'userId': {
                type: Sequelize.INTEGER,
                references: {
                    model: this.User
                },
                field: 'user_id'
            }
        }, opts);

        this.Account = sequelize.define('accounts', {
            'id': {
                type: Sequelize.STRING,
                primaryKey: true
            },
            'itemId': {
                type: Sequelize.STRING,
                references: {
                    model: this.Item
                },
                field: 'item_id'
            },
            'balance': {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            'name': {
                type: Sequelize.STRING
            },
            'mask': {
                type: Sequelize.STRING
            },
            'type': {
                type: Sequelize.STRING
            }
        }, opts);

        let uniqueBalance = {
            indexes: [{
                unique: true,
                fields: ["date_of", "account_id"]
            }]
        };

        this.BalanceHistory = sequelize.define('balance_history', {
            dateOf: {
                type: Sequelize.DATE,
                allowNull: false,
                field: 'date_of'
            },
            'accountId': {
                type: Sequelize.STRING,
                references: {
                    model: this.Account
                },
                allowNull: false,
                field: 'account_id'
            },
            'balance': {
                type: Sequelize.INTEGER,
                allowNull: false
            }
        }, Object.assign({}, uniqueBalance, opts));

        this.Transaction = sequelize.define('transactions', {
            'id': {
                type: Sequelize.STRING,
                primaryKey: true
            },
            'amount': {
                type: Sequelize.STRING,
                allowNull: false
            },
            'accountId': {
                type: Sequelize.STRING,
                references: {
                    model: this.Account
                },
                field: "account_id"
            },
            'categories': {
                type: Sequelize.STRING,
                validate: {
                    isJson(str) {
                        // str can be null
                        str && JSON.parse(str);
                    }
                }

            },
            'categoryId': {
                type: Sequelize.STRING,
                field: "category_id"
            },
            'dateOf': {
                type: Sequelize.DATE,
                field: "date_of"
            },
            'location': {
                type: Sequelize.STRING,
                validate: {
                    isJson(str) {
                        // str can be null
                        str && JSON.parse(str);
                    }
                }
            },
            'name': {
                type: Sequelize.STRING
            }
        }, opts);

        this.User.hasMany(this.Item);
        this.Item.hasMany(this.Account);
        this.Account.hasMany(this.Transaction);
        this.Account.hasMany(this.BalanceHistory);
        this.Item.belongsTo(this.User);
        this.Account.belongsTo(this.Item);
        this.Transaction.belongsTo(this.Account);
        this.BalanceHistory.belongsTo(this.Account);
    }
}

module.exports =  Model;
