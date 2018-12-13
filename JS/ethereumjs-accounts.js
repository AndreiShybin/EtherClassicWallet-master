(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Accounts = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global,Buffer){
/**
ethereumjs-accounts - A suite for managing Ethereum accounts in browser.

Welcome to ethereumjs-accounts. Generate, encrypt, manage, export and remove Ethereum accounts and store them in your browsers local storage. You may also choose to extendWeb3 so that transactions made from accounts stored in browser, can be signed with the private key provided. EthereumJs-Accounts also supports account encryption using the AES encryption protocol. You may choose to optionally encrypt your Ethereum account data with a passphrase to prevent others from using or accessing your account.

Requires:
 - cryptojs v0.3.1  <https://github.com/fahad19/crypto-js>
 - localstorejs *  <https://github.com/SilentCicero/localstore>
 - ethereumjs-tx v0.4.0  <https://www.npmjs.com/package/ethereumjs-tx>
 - ethereumjs-tx v1.2.0  <https://www.npmjs.com/package/ethereumjs-util>
 - Underscore.js v1.8.3+  <http://underscorejs.org/>
 - Web3.js v0.4.2+ <https://github.com/ethereum/web3.js>

Commands:
    (Browserify)
    browserify --s Accounts index.js -o dist/ethereumjs-accounts.js

    (Run)
    node index.js

    (NPM)
    npm install ethereumjs-accounts

    (Meteor)
    meteor install silentcicero:ethereumjs-accounts    
**/

var _ = require('underscore');
var Tx = require('ethereumjs-tx');
var LocalStore = require('localstorejs');
var BigNumber = require('bignumber.js');
var JSZip = require("jszip");
var FileSaver = require("node-safe-filesaver");
global.CryptoJS = require('browserify-cryptojs');
require('browserify-cryptojs/components/enc-base64');
require('browserify-cryptojs/components/md5');
require('browserify-cryptojs/components/evpkdf');
require('browserify-cryptojs/components/cipher-core');
require('browserify-cryptojs/components/aes');

/**
The Accounts constructor method. This method will construct the in browser Ethereum accounts manager.

@class Accounts
@constructor
@method (Accounts)
@param {Object} options       The accounts object options.
**/

var Accounts = module.exports = function(options){
    if(_.isUndefined(options))
        options = {};
    
    // setup default options
    var defaultOptions = {
        varName: 'ethereumAccounts'
        , minPassphraseLength: 6
        , requirePassphrase: false
        , selectNew: true
        , defaultGasPrice: 'useWeb3'
        , request: function(accountObject){
            var passphrase = prompt("Please enter your account passphrase for address " + accountObject.address.substr(0, 8) + '...', "passphrase");
            
            if(passphrase == null)
                passphrase = '';
            
            return String(passphrase);
        }
    };
    
    // build options
    this.options = _.extend(defaultOptions, options);
    
    // define Accounts object properties
    defineProperties(this);
    
    // get accounts object, if any
    var accounts = LocalStore.get(this.options.varName);
    
    // if no accounts object exists, create one
    if(_.isUndefined(accounts) || !_.isObject(accounts))
        LocalStore.set(this.options.varName, {});
};


/**
Pad the given string with a prefix zero, if length is uneven.

@method (formatHex)
@param {String} str    The string to pad for use as hex
@return {String} The padded or formatted string for use as a hex string
**/

var formatHex = function(str){
    return String(str).length % 2 ? '0' + String(str) : String(str);
};


/**
Prepair numbers for raw transactions.

@method (formatNumber)
@param {Number|String|BigNumber} The object to be used as a number
@return {String} The padded, toString hex value of the number
**/

var formatNumber = function(num){
    if(_.isUndefined(num) || num == 0)
        num = '00';
    
    if(_.isString(num) || _.isNumber(num))
        num = new BigNumber(String(num));
    
    if(isBigNumber(num))
        num = num.toString(16);
    
    return formatHex(num);
};


/**
Prepair Ethereum address for either raw transactions or browser storage.

@method (formatAddress)
@param {String} addr    An ethereum address to prep
@param {String} format          The format type (i.e. 'raw' or 'hex')
@return {String} The prepaired ethereum address
**/

var formatAddress = function(addr, format){
    if(_.isUndefined(format) || !_.isString(format))
        format = 'hex';
    
    if(_.isUndefined(addr)
       || !_.isString(addr))
        addr = '0000000000000000000000000000000000000000';
    
    if(addr.substr(0, 2) == '0x' && format == 'raw')
        addr = addr.substr(2);
    
    if(addr.substr(0, 2) != '0x' && format == 'hex')
        addr = '0x' + addr;
    
    return addr;
};


/**
Generate 16 random alpha numeric bytes.

@method (randomBytes)
@param {Number} length      The string length that should be generated
@return {String} A 16 char/UTF-8 byte string of random alpha-numeric characters
**/

var randomBytes = function(length) {
    var charset = "abcdef0123456789";
    var i;
    var result = "";
    var isOpera = Object.prototype.toString.call(window.opera) == '[object Opera]';
    if(window.crypto && window.crypto.getRandomValues) {
        values = new Uint32Array(length);
        window.crypto.getRandomValues(values);
        for(i=0; i<length; i++) {
            result += charset[values[i] % charset.length];
        }
        return result;
    } else if(isOpera) {//Opera's Math.random is secure, see http://lists.w3.org/Archives/Public/public-webcrypto/2013Jan/0063.html
        for(i=0; i<length; i++) {
            result += charset[Math.floor(Math.random()*charset.length)];
        }
        return result;
    }
    else throw new Error("Your browser sucks and can't generate secure random numbers");
}


/**
Is the object provided a Bignumber object.

@method (isBigNumber)
**/

var isBigNumber = function(value){
    if(_.isUndefined(value) || !_.isObject(value))
        return false;
    
    return (value instanceof BigNumber) ? true : false;
};

/**
 * Checks if the given string is an address
 *
 * @method isAddress
 * @param {String} address the given HEX adress
 * @return {Boolean}
 **/

var isAddress = function (address) {
    return /^(0x)?[0-9a-f]{40}$/.test(address);
};


/**
Define object properties such as 'length'.

@method (defineProperties)
@param {Object} context     The Accounts object context
**/

var defineProperties = function(context){
    Object.defineProperty(context, 'length', {
        get: function() {
            var count = 0;

            // count valid accounts in browser storage
            _.each(this.get(), function(account, accountIndex){  
                if(_.isUndefined(account)
                  || !_.isObject(account)
                  || _.isString(account))
                    return;

                if(!_.has(account, 'encrypted')
                   || !_.has(account, 'private'))
                    return;

                count += 1;
            });

            return count;
        }
    });
};


/**
Returns true when a valid passphrase is provided.

@method (isPassphrase)
@param {String} passphrase    A valid ethereum passphrase
@return {Boolean} Whether the passphrase is valid or invalid.
**/

Accounts.prototype.isPassphrase = function(passphrase){
    if(!_.isUndefined(passphrase)
       && _.isString(passphrase)
       && !_.isEmpty(passphrase)
       && String(passphrase).length > this.options.minPassphraseLength)
        return true;
};


/**
This will set in browser accounts data at a specified address with the specified accountObject data.

@method (set)
@param {String} address          The address of the account
@param {Object} accountObject    The account object data.
**/

Accounts.prototype.set = function(address, accountObject){
    var accounts = LocalStore.get('ethereumAccounts');    
    
    // if object, store; if null, delete
    if(_.isObject(accountObject))
        accounts[formatAddress(address)] = accountObject;   
    else
        delete accounts[formatAddress(address)];
    
    this.log('Setting account object at address: ' + address + ' to account object ' + String(accountObject));
    
    LocalStore.set(this.options.varName, accounts);
};


/**
Remove an account from the Ethereum accounts stored in browser

@method (remove)
@param {String} address          The address of the account stored in browser
**/

Accounts.prototype.remove = function(address){
    this.set(address, null);
};


/**
Generate a new Ethereum account in browser with a passphrase that will encrypt the public and private keys with AES for storage.

@method (new)
@param {String} passphrase          The passphrase to encrypt the public and private keys.
@return {Object} an account object with the public and private keys included.
**/

Accounts.prototype.new = function(passphrase){
    var private = new Buffer(randomBytes(64), 'hex');
    var public = ethUtil.privateToPublic(private);
    var address = formatAddress(ethUtil.publicToAddress(public)
                                .toString('hex'));
    var accountObject = {
        address: address
        , encrypted: false
        , locked: false
        , hash: ethUtil.sha3(public.toString('hex') + private.toString('hex')).toString('hex')
    };
    
    // if passphrrase provided or required, attempt account encryption
    if((!_.isUndefined(passphrase) && !_.isEmpty(passphrase)) 
        || this.options.requirePassphrase){
        if(this.isPassphrase(passphrase)) {
            private = CryptoJS.AES
                .encrypt(private.toString('hex'), passphrase)
                .toString();
            public = CryptoJS.AES
                .encrypt(public.toString('hex'), passphrase)
                .toString();
            accountObject.encrypted = true;
            accountObject.locked = true;
        } else {
            this.log('The passphrase you tried to use was invalid.');
            private = private.toString('hex')
            public = public.toString('hex')
        }
    }else{
        private = private.toString('hex')
        public = public.toString('hex')
    }
    
    // Set account object private and public keys
    accountObject.private = private;
    accountObject.public = public;
    this.set(address, accountObject);
    
    this.log('New address created');
    
    // If option select new is true
    if(this.options.selectNew)
        this.select(accountObject.address);
    
    return accountObject;
};


/**
Select the account that will be used when transactions are made.

@method (select)
@param {String} address          The address of the account to select
**/

Accounts.prototype.select = function(address) {
    var accounts = LocalStore.get(this.options.varName);
    
    if(!this.contains(address))
        return;
    
    accounts['selected'] = address;
    LocalStore.set(this.options.varName, accounts);
};


/**
Get an account object that is stored in local browser storage. If encrypted, decrypt it with the passphrase.

@method (new)
@param {String} passphrase          The passphrase to encrypt the public and private keys.
@return {Object} an account object with the public and private keys included.
**/

Accounts.prototype.get = function(address, passphrase){
    var accounts = LocalStore.get(this.options.varName);    
    
    if(_.isUndefined(address) || _.isEmpty(address))
        return accounts;
    
    if(address == 'selected')
        address = accounts.selected;
    
    var accountObject = {};    
    address = formatAddress(address);
    
    if(!this.contains(address))
        return accountObject;
    
    accountObject = accounts[address];
    
    if(_.isEmpty(accountObject))
        return accountObject;
    
    // If a passphrase is provided, decrypt private and public key
    if(this.isPassphrase(passphrase) && accountObject.encrypted) {
        try {
            accountObject.private = CryptoJS.AES
                .decrypt(accountObject.private, passphrase)
                .toString(CryptoJS.enc.Utf8);
            accountObject.public = CryptoJS.AES
                .decrypt(accountObject.public, passphrase)
                .toString(CryptoJS.enc.Utf8);
            
            if(ethUtil.sha3(accountObject.public + accountObject.private).toString('hex') == accountObject.hash)
                accountObject.locked = false;
        }catch(e){
            this.log('Error while decrypting public/private keys: ' + String(e));
        }
    }
    
    return accountObject;
};


/**
Clear all stored Ethereum accounts in browser.

@method (clear)
**/

Accounts.prototype.clear = function(){
    this.log('Clearing all accounts');
    LocalStore.set(this.options.varName, {});
};


/**
Does the account exist in browser storage, given the specified account address.

@method (contains)
@param {String} address          The account address
@return {Boolean} Does the account exists or not given the specified address
**/

Accounts.prototype.contains = function(address){
    var accounts = LocalStore.get(this.options.varName);
    
    if(_.isUndefined(address)
       || _.isEmpty(address))
        return false;
    
    // Add '0x' prefix if not available
    address = formatAddress(address);
    
    // If account with address exists.
    if(_.has(accounts, address))
        return (!_.isUndefined(accounts[address]) && !_.isEmpty(accounts[address]));
    
    return false;
};


/**
Export the accounts to a JSON ready string.

@method (export)
@return {String} A JSON ready string
**/

Accounts.prototype.export = function(){
    this.log('Exported accounts');
    
    return JSON.stringify(this.get());
};


/**
Import a JSON ready string. This will import JSON data, parse it, and attempt to use it as accounts data.

@method (import)
@param {String} A JSON ready string
@return {String} How many accountObject's were added
**/

Accounts.prototype.import = function(JSON_data){
    var JSON_data = JSON_data.trim();
    var parsed = JSON.parse(JSON_data);
    var count = 0;
    var _this = this;
    
    _.each(parsed, function(accountObject, accountIndex){
        if(!_.has(accountObject, 'private')
           || !_.has(accountObject, 'hash')
           || !_.has(accountObject, 'address')
           || !_.has(accountObject, 'encrypted')
           || !_.has(accountObject, 'locked'))
            return;
        
        count += 1;
        _this.set(accountObject.address, accountObject);
    });
    
    this.log('Imported ' + String(count) + ' accounts');
    
    return count;
};


/**
Backup your accounts in a zip file.

@method (backup)
**/

Accounts.prototype.backup = function(){
    var zip = new JSZip();
    zip.file("wallet", this.export());
    var content = zip.generate({type:"blob"});
    var dateString = new Date();
    this.log('Saving wallet as: ' + "wallet-" + dateString.toISOString() + ".zip");
    FileSaver.saveAs(content, "wallet-" + dateString.toISOString() + ".zip");
};


/**
A log function that will log all actions that occur with ethereumjs-accounts.

@method (log)
**/

Accounts.prototype.log = function(){};


/**
Return all accounts as a list array.

@method (list)
@return {Array} a list array of all accounts
**/

Accounts.prototype.list = function(){
    var accounts = LocalStore.get('ethereumAccounts'),
        return_array = [];
    
    _.each(_.keys(accounts), function(accountKey, accountIndex){
       if(accountKey != "selected")
           return_array.push(accounts[accountKey]);
    });
        
    return return_array;
};


/**
This method will override web3.eth.sendTransaction, and assemble transactions given the data provided, only for transactions sent from an account stored in browser. If sendTransaction is used with a normal account not stored in browser, sendTransaction will not be overridden.

@method (extendWeb3)
**/

Accounts.prototype.extendWeb3 = function(){
    // If web3 is not init. yet
    if(typeof web3 === "undefined") {
        this.log('WARNING: The web3 object does not exist or has not been initiated yet. Please include and initiate the web3 object');
        return;
    }
    
    // If web3 does not have sendRawTransaction
    if(!_.has(web3.eth, 'sendRawTransaction')) {
        this.log('WARNING: The web3 object does not contain the sendRawTransaction method which is required to extend web3.eth.sendTransaction. Please use an edition of web3 that contains the method "web3.eth.sendRawTransaction".');        
        return;
    }
    
    // Store old instance of sendTransaction and sendRawTransaction
    var transactMethod = web3.eth.sendTransaction;
    var rawTransactionMethod = web3.eth.sendRawTransaction;
    
    // Accounts instance
    var accounts = this;
    
    // Get default gas price
    if(this.options.defaultGasPrice == 'useWeb3') {
        web3.eth.getGasPrice(function(err, result){            
            if(!err)
                accounts.gasPrice = result;
        });
    }
    
    // Override web3.eth.sendTransaction
    web3.eth.sendTransaction = function(){
        var args = Array.prototype.slice.call(arguments);
        var optionsObject = {};
        var callback = null;
        var positions = {};
        
        // Go through sendTransaction args (param1, param2, options, etc..)
        _.each(args, function(arg, argIndex){
            // the arg is an object, thats not a BN, so it's the options
            if(_.isObject(arg) 
               && !isBigNumber(arg) 
               && !_.isFunction(arg) 
               && _.has(arg, 'from')) {
                optionsObject = arg;
                positions['options'] = argIndex;
            }
            
            // the arg is a function, so it must be the callback
            if(_.isFunction(arg)) {
                callback = arg;
                positions.callback = argIndex;
            }
        });

        if (callback == null) {
            throw new Error("You must provide a callback to web3.eth.sendTransaction() when using ethereumjs-accounts")
        }
        
        // if from is an account stored in browser, build raw TX and send
        if(accounts.contains(optionsObject.from)) {   
            // Get the account of address set in sendTransaction options, from the accounts stored in browser
            var account = accounts.get(optionsObject.from);
            
            // if the account is encrypted, try to decrypt it
            if(account.encrypted) {
                account = accounts.get(optionsObject.from
                                       ,accounts.options.request(account));
            }
            
            // if account is still locked, quit
            if(account.locked) {
                accounts.log('Account locked!');
                return;
            }
            
            web3.eth.getTransactionCount(account.address, function(err, getNonce) {
                if (err != null) {
                    callback(err);
                    return;
                }

                web3.eth.getGasPrice(function(err, gasPrice) {
                    if (err != null) {
                        callback(err);
                        return;
                    }

                    // Assemble the default raw transaction data
                    var rawTx = {
                        nonce: formatHex(getNonce),
                        gasPrice: formatHex(gasPrice.toString(16)),
                        gasLimit: formatHex(new BigNumber('1900000').toString(16)),
                        value: '00',
                        data: '00'
                    };

                    // Set whatever properties are available from the sendTransaction options object
                    if(_.has(optionsObject, 'gasPrice'))
                        rawTx.gasPrice = formatHex(formatNumber(optionsObject.gasPrice));
                    
                    if(_.has(optionsObject, 'gasLimit'))
                        rawTx.gasLimit = formatHex(formatNumber(optionsObject.gasLimit));
                    
                    if(_.has(optionsObject, 'gas'))
                        rawTx.gasLimit = formatHex(formatNumber(optionsObject.gas));
                    
                    if(_.has(optionsObject, 'to'))
                        rawTx.to = ethUtil.stripHexPrefix(optionsObject.to);
                    
                    if(_.has(optionsObject, 'value'))
                        rawTx.value = formatNumber(optionsObject.value);
                    
                    if(_.has(optionsObject, 'data'))
                        rawTx.data = ethUtil.stripHexPrefix(formatHex(optionsObject.data));
                    
                    if(_.has(optionsObject, 'code'))
                        rawTx.data = ethUtil.stripHexPrefix(formatHex(optionsObject.code));
                    
                    // convert string private key to a Buffer Object
                    var privateKey = new Buffer(account.private, 'hex');
                    
                    // init new transaction object, and sign the transaction
                    var tx = new Tx(rawTx);
                    tx.sign(privateKey);
                    
                    // Build a serialized hex version of the Tx
                    var serializedTx = '0x' + tx.serialize().toString('hex');
                    
                    // call the web3.eth.sendRawTransaction with 
                    rawTransactionMethod(serializedTx, callback);   
                });
            });
        }else{
            // If the transaction is not using an account stored in browser, send as usual with web3.eth.sendTransaction
            transactMethod.apply(this, args);
        }
    };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"bignumber.js":2,"browserify-cryptojs":8,"browserify-cryptojs/components/aes":3,"browserify-cryptojs/components/cipher-core":4,"browserify-cryptojs/components/enc-base64":5,"browserify-cryptojs/components/evpkdf":6,"browserify-cryptojs/components/md5":7,"buffer":115,"ethereumjs-tx":10,"jszip":78,"localstorejs":109,"node-safe-filesaver":111,"underscore":112}],2:[function(require,module,exports){
/*! bignumber.js v2.0.7 https://github.com/MikeMcl/bignumber.js/LICENCE */

;(function (global) {
    'use strict';

    /*
      bignumber.js v2.0.7
      A JavaScript library for arbitrary-precision arithmetic.
      https://github.com/MikeMcl/bignumber.js
      Copyright (c) 2015 Michael Mclaughlin <M8ch88l@gmail.com>
      MIT Expat Licence
    */


    var BigNumber, crypto, parseNumeric,
        isNumeric = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,
        mathceil = Math.ceil,
        mathfloor = Math.floor,
        notBool = ' not a boolean or binary digit',
        roundingMode = 'rounding mode',
        tooManyDigits = 'number type has more than 15 significant digits',
        ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_',
        BASE = 1e14,
        LOG_BASE = 14,
        MAX_SAFE_INTEGER = 0x1fffffffffffff,         // 2^53 - 1
        // MAX_INT32 = 0x7fffffff,                   // 2^31 - 1
        POWS_TEN = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13],
        SQRT_BASE = 1e7,

        /*
         * The limit on the value of DECIMAL_PLACES, TO_EXP_NEG, TO_EXP_POS, MIN_EXP, MAX_EXP, and
         * the arguments to toExponential, toFixed, toFormat, and toPrecision, beyond which an
         * exception is thrown (if ERRORS is true).
         */
        MAX = 1E9;                                   // 0 to MAX_INT32


    /*
     * Create and return a BigNumber constructor.
     */
    function another(configObj) {
        var div,

            // id tracks the caller function, so its name can be included in error messages.
            id = 0,
            P = BigNumber.prototype,
            ONE = new BigNumber(1),


            /********************************* EDITABLE DEFAULTS **********************************/


            /*
             * The default values below must be integers within the inclusive ranges stated.
             * The values can also be changed at run-time using BigNumber.config.
             */

            // The maximum number of decimal places for operations involving division.
            DECIMAL_PLACES = 20,                     // 0 to MAX

            /*
             * The rounding mode used when rounding to the above decimal places, and when using
             * toExponential, toFixed, toFormat and toPrecision, and round (default value).
             * UP         0 Away from zero.
             * DOWN       1 Towards zero.
             * CEIL       2 Towards +Infinity.
             * FLOOR      3 Towards -Infinity.
             * HALF_UP    4 Towards nearest neighbour. If equidistant, up.
             * HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
             * HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
             * HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
             * HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
             */
            ROUNDING_MODE = 4,                       // 0 to 8

            // EXPONENTIAL_AT : [TO_EXP_NEG , TO_EXP_POS]

            // The exponent value at and beneath which toString returns exponential notation.
            // Number type: -7
            TO_EXP_NEG = -7,                         // 0 to -MAX

            // The exponent value at and above which toString returns exponential notation.
            // Number type: 21
            TO_EXP_POS = 21,                         // 0 to MAX

            // RANGE : [MIN_EXP, MAX_EXP]

            // The minimum exponent value, beneath which underflow to zero occurs.
            // Number type: -324  (5e-324)
            MIN_EXP = -1e7,                          // -1 to -MAX

            // The maximum exponent value, above which overflow to Infinity occurs.
            // Number type:  308  (1.7976931348623157e+308)
            // For MAX_EXP > 1e7, e.g. new BigNumber('1e100000000').plus(1) may be slow.
            MAX_EXP = 1e7,                           // 1 to MAX

            // Whether BigNumber Errors are ever thrown.
            ERRORS = true,                           // true or false

            // Change to intValidatorNoErrors if ERRORS is false.
            isValidInt = intValidatorWithErrors,     // intValidatorWithErrors/intValidatorNoErrors

            // Whether to use cryptographically-secure random number generation, if available.
            CRYPTO = false,                          // true or false

            /*
             * The modulo mode used when calculating the modulus: a mod n.
             * The quotient (q = a / n) is calculated according to the corresponding rounding mode.
             * The remainder (r) is calculated as: r = a - n * q.
             *
             * UP        0 The remainder is positive if the dividend is negative, else is negative.
             * DOWN      1 The remainder has the same sign as the dividend.
             *             This modulo mode is commonly known as 'truncated division' and is
             *             equivalent to (a % n) in JavaScript.
             * FLOOR     3 The remainder has the same sign as the divisor (Python %).
             * HALF_EVEN 6 This modulo mode implements the IEEE 754 remainder function.
             * EUCLID    9 Euclidian division. q = sign(n) * floor(a / abs(n)).
             *             The remainder is always positive.
             *
             * The truncated division, floored division, Euclidian division and IEEE 754 remainder
             * modes are commonly used for the modulus operation.
             * Although the other rounding modes can also be used, they may not give useful results.
             */
            MODULO_MODE = 1,                         // 0 to 9

            // The maximum number of significant digits of the result of the toPower operation.
            // If POW_PRECISION is 0, there will be unlimited significant digits.
            POW_PRECISION = 100,                     // 0 to MAX

            // The format specification used by the BigNumber.prototype.toFormat method.
            FORMAT = {
                decimalSeparator: '.',
                groupSeparator: ',',
                groupSize: 3,
                secondaryGroupSize: 0,
                fractionGroupSeparator: '\xA0',      // non-breaking space
                fractionGroupSize: 0
            };


        /******************************************************************************************/


        // CONSTRUCTOR


        /*
         * The BigNumber constructor and exported function.
         * Create and return a new instance of a BigNumber object.
         *
         * n {number|string|BigNumber} A numeric value.
         * [b] {number} The base of n. Integer, 2 to 64 inclusive.
         */
        function BigNumber( n, b ) {
            var c, e, i, num, len, str,
                x = this;

            // Enable constructor usage without new.
            if ( !( x instanceof BigNumber ) ) {

                // 'BigNumber() constructor call without new: {n}'
                if (ERRORS) raise( 26, 'constructor call without new', n );
                return new BigNumber( n, b );
            }

            // 'new BigNumber() base not an integer: {b}'
            // 'new BigNumber() base out of range: {b}'
            if ( b == null || !isValidInt( b, 2, 64, id, 'base' ) ) {

                // Duplicate.
                if ( n instanceof BigNumber ) {
                    x.s = n.s;
                    x.e = n.e;
                    x.c = ( n = n.c ) ? n.slice() : n;
                    id = 0;
                    return;
                }

                if ( ( num = typeof n == 'number' ) && n * 0 == 0 ) {
                    x.s = 1 / n < 0 ? ( n = -n, -1 ) : 1;

                    // Fast path for integers.
                    if ( n === ~~n ) {
                        for ( e = 0, i = n; i >= 10; i /= 10, e++ );
                        x.e = e;
                        x.c = [n];
                        id = 0;
                        return;
                    }

                    str = n + '';
                } else {
                    if ( !isNumeric.test( str = n + '' ) ) return parseNumeric( x, str, num );
                    x.s = str.charCodeAt(0) === 45 ? ( str = str.slice(1), -1 ) : 1;
                }
            } else {
                b = b | 0;
                str = n + '';

                // Ensure return value is rounded to DECIMAL_PLACES as with other bases.
                // Allow exponential notation to be used with base 10 argument.
                if ( b == 10 ) {
                    x = new BigNumber( n instanceof BigNumber ? n : str );
                    return round( x, DECIMAL_PLACES + x.e + 1, ROUNDING_MODE );
                }

                // Avoid potential interpretation of Infinity and NaN as base 44+ values.
                // Any number in exponential form will fail due to the [Ee][+-].
                if ( ( num = typeof n == 'number' ) && n * 0 != 0 ||
                  !( new RegExp( '^-?' + ( c = '[' + ALPHABET.slice( 0, b ) + ']+' ) +
                    '(?:\\.' + c + ')?$',b < 37 ? 'i' : '' ) ).test(str) ) {
                    return parseNumeric( x, str, num, b );
                }

                if (num) {
                    x.s = 1 / n < 0 ? ( str = str.slice(1), -1 ) : 1;

                    if ( ERRORS && str.replace( /^0\.0*|\./, '' ).length > 15 ) {

                        // 'new BigNumber() number type has more than 15 significant digits: {n}'
                        raise( id, tooManyDigits, n );
                    }

                    // Prevent later check for length on converted number.
                    num = false;
                } else {
                    x.s = str.charCodeAt(0) === 45 ? ( str = str.slice(1), -1 ) : 1;
                }

                str = convertBase( str, 10, b, x.s );
            }

            // Decimal point?
            if ( ( e = str.indexOf('.') ) > -1 ) str = str.replace( '.', '' );

            // Exponential form?
            if ( ( i = str.search( /e/i ) ) > 0 ) {

                // Determine exponent.
                if ( e < 0 ) e = i;
                e += +str.slice( i + 1 );
                str = str.substring( 0, i );
            } else if ( e < 0 ) {

                // Integer.
                e = str.length;
            }

            // Determine leading zeros.
            for ( i = 0; str.charCodeAt(i) === 48; i++ );

            // Determine trailing zeros.
            for ( len = str.length; str.charCodeAt(--len) === 48; );
            str = str.slice( i, len + 1 );

            if (str) {
                len = str.length;

                // Disallow numbers with over 15 significant digits if number type.
                // 'new BigNumber() number type has more than 15 significant digits: {n}'
                if ( num && ERRORS && len > 15 ) raise( id, tooManyDigits, x.s * n );

                e = e - i - 1;

                 // Overflow?
                if ( e > MAX_EXP ) {

                    // Infinity.
                    x.c = x.e = null;

                // Underflow?
                } else if ( e < MIN_EXP ) {

                    // Zero.
                    x.c = [ x.e = 0 ];
                } else {
                    x.e = e;
                    x.c = [];

                    // Transform base

                    // e is the base 10 exponent.
                    // i is where to slice str to get the first element of the coefficient array.
                    i = ( e + 1 ) % LOG_BASE;
                    if ( e < 0 ) i += LOG_BASE;

                    if ( i < len ) {
                        if (i) x.c.push( +str.slice( 0, i ) );

                        for ( len -= LOG_BASE; i < len; ) {
                            x.c.push( +str.slice( i, i += LOG_BASE ) );
                        }

                        str = str.slice(i);
                        i = LOG_BASE - str.length;
                    } else {
                        i -= len;
                    }

                    for ( ; i--; str += '0' );
                    x.c.push( +str );
                }
            } else {

                // Zero.
                x.c = [ x.e = 0 ];
            }

            id = 0;
        }


        // CONSTRUCTOR PROPERTIES


        BigNumber.another = another;

        BigNumber.ROUND_UP = 0;
        BigNumber.ROUND_DOWN = 1;
        BigNumber.ROUND_CEIL = 2;
        BigNumber.ROUND_FLOOR = 3;
        BigNumber.ROUND_HALF_UP = 4;
        BigNumber.ROUND_HALF_DOWN = 5;
        BigNumber.ROUND_HALF_EVEN = 6;
        BigNumber.ROUND_HALF_CEIL = 7;
        BigNumber.ROUND_HALF_FLOOR = 8;
        BigNumber.EUCLID = 9;


        /*
         * Configure infrequently-changing library-wide settings.
         *
         * Accept an object or an argument list, with one or many of the following properties or
         * parameters respectively:
         *
         *   DECIMAL_PLACES  {number}  Integer, 0 to MAX inclusive
         *   ROUNDING_MODE   {number}  Integer, 0 to 8 inclusive
         *   EXPONENTIAL_AT  {number|number[]}  Integer, -MAX to MAX inclusive or
         *                                      [integer -MAX to 0 incl., 0 to MAX incl.]
         *   RANGE           {number|number[]}  Non-zero integer, -MAX to MAX inclusive or
         *                                      [integer -MAX to -1 incl., integer 1 to MAX incl.]
         *   ERRORS          {boolean|number}   true, false, 1 or 0
         *   CRYPTO          {boolean|number}   true, false, 1 or 0
         *   MODULO_MODE     {number}           0 to 9 inclusive
         *   POW_PRECISION   {number}           0 to MAX inclusive
         *   FORMAT          {object}           See BigNumber.prototype.toFormat
         *      decimalSeparator       {string}
         *      groupSeparator         {string}
         *      groupSize              {number}
         *      secondaryGroupSize     {number}
         *      fractionGroupSeparator {string}
         *      fractionGroupSize      {number}
         *
         * (The values assigned to the above FORMAT object properties are not checked for validity.)
         *
         * E.g.
         * BigNumber.config(20, 4) is equivalent to
         * BigNumber.config({ DECIMAL_PLACES : 20, ROUNDING_MODE : 4 })
         *
         * Ignore properties/parameters set to null or undefined.
         * Return an object with the properties current values.
         */
        BigNumber.config = function () {
            var v, p,
                i = 0,
                r = {},
                a = arguments,
                o = a[0],
                has = o && typeof o == 'object'
                  ? function () { if ( o.hasOwnProperty(p) ) return ( v = o[p] ) != null; }
                  : function () { if ( a.length > i ) return ( v = a[i++] ) != null; };

            // DECIMAL_PLACES {number} Integer, 0 to MAX inclusive.
            // 'config() DECIMAL_PLACES not an integer: {v}'
            // 'config() DECIMAL_PLACES out of range: {v}'
            if ( has( p = 'DECIMAL_PLACES' ) && isValidInt( v, 0, MAX, 2, p ) ) {
                DECIMAL_PLACES = v | 0;
            }
            r[p] = DECIMAL_PLACES;

            // ROUNDING_MODE {number} Integer, 0 to 8 inclusive.
            // 'config() ROUNDING_MODE not an integer: {v}'
            // 'config() ROUNDING_MODE out of range: {v}'
            if ( has( p = 'ROUNDING_MODE' ) && isValidInt( v, 0, 8, 2, p ) ) {
                ROUNDING_MODE = v | 0;
            }
            r[p] = ROUNDING_MODE;

            // EXPONENTIAL_AT {number|number[]}
            // Integer, -MAX to MAX inclusive or [integer -MAX to 0 inclusive, 0 to MAX inclusive].
            // 'config() EXPONENTIAL_AT not an integer: {v}'
            // 'config() EXPONENTIAL_AT out of range: {v}'
            if ( has( p = 'EXPONENTIAL_AT' ) ) {

                if ( isArray(v) ) {
                    if ( isValidInt( v[0], -MAX, 0, 2, p ) && isValidInt( v[1], 0, MAX, 2, p ) ) {
                        TO_EXP_NEG = v[0] | 0;
                        TO_EXP_POS = v[1] | 0;
                    }
                } else if ( isValidInt( v, -MAX, MAX, 2, p ) ) {
                    TO_EXP_NEG = -( TO_EXP_POS = ( v < 0 ? -v : v ) | 0 );
                }
            }
            r[p] = [ TO_EXP_NEG, TO_EXP_POS ];

            // RANGE {number|number[]} Non-zero integer, -MAX to MAX inclusive or
            // [integer -MAX to -1 inclusive, integer 1 to MAX inclusive].
            // 'config() RANGE not an integer: {v}'
            // 'config() RANGE cannot be zero: {v}'
            // 'config() RANGE out of range: {v}'
            if ( has( p = 'RANGE' ) ) {

                if ( isArray(v) ) {
                    if ( isValidInt( v[0], -MAX, -1, 2, p ) && isValidInt( v[1], 1, MAX, 2, p ) ) {
                        MIN_EXP = v[0] | 0;
                        MAX_EXP = v[1] | 0;
                    }
                } else if ( isValidInt( v, -MAX, MAX, 2, p ) ) {
                    if ( v | 0 ) MIN_EXP = -( MAX_EXP = ( v < 0 ? -v : v ) | 0 );
                    else if (ERRORS) raise( 2, p + ' cannot be zero', v );
                }
            }
            r[p] = [ MIN_EXP, MAX_EXP ];

            // ERRORS {boolean|number} true, false, 1 or 0.
            // 'config() ERRORS not a boolean or binary digit: {v}'
            if ( has( p = 'ERRORS' ) ) {

                if ( v === !!v || v === 1 || v === 0 ) {
                    id = 0;
                    isValidInt = ( ERRORS = !!v ) ? intValidatorWithErrors : intValidatorNoErrors;
                } else if (ERRORS) {
                    raise( 2, p + notBool, v );
                }
            }
            r[p] = ERRORS;

            // CRYPTO {boolean|number} true, false, 1 or 0.
            // 'config() CRYPTO not a boolean or binary digit: {v}'
            // 'config() crypto unavailable: {crypto}'
            if ( has( p = 'CRYPTO' ) ) {

                if ( v === !!v || v === 1 || v === 0 ) {
                    CRYPTO = !!( v && crypto && typeof crypto == 'object' );
                    if ( v && !CRYPTO && ERRORS ) raise( 2, 'crypto unavailable', crypto );
                } else if (ERRORS) {
                    raise( 2, p + notBool, v );
                }
            }
            r[p] = CRYPTO;

            // MODULO_MODE {number} Integer, 0 to 9 inclusive.
            // 'config() MODULO_MODE not an integer: {v}'
            // 'config() MODULO_MODE out of range: {v}'
            if ( has( p = 'MODULO_MODE' ) && isValidInt( v, 0, 9, 2, p ) ) {
                MODULO_MODE = v | 0;
            }
            r[p] = MODULO_MODE;

            // POW_PRECISION {number} Integer, 0 to MAX inclusive.
            // 'config() POW_PRECISION not an integer: {v}'
            // 'config() POW_PRECISION out of range: {v}'
            if ( has( p = 'POW_PRECISION' ) && isValidInt( v, 0, MAX, 2, p ) ) {
                POW_PRECISION = v | 0;
            }
            r[p] = POW_PRECISION;

            // FORMAT {object}
            // 'config() FORMAT not an object: {v}'
            if ( has( p = 'FORMAT' ) ) {

                if ( typeof v == 'object' ) {
                    FORMAT = v;
                } else if (ERRORS) {
                    raise( 2, p + ' not an object', v );
                }
            }
            r[p] = FORMAT;

            return r;
        };


        /*
         * Return a new BigNumber whose value is the maximum of the arguments.
         *
         * arguments {number|string|BigNumber}
         */
        BigNumber.max = function () { return maxOrMin( arguments, P.lt ); };


        /*
         * Return a new BigNumber whose value is the minimum of the arguments.
         *
         * arguments {number|string|BigNumber}
         */
        BigNumber.min = function () { return maxOrMin( arguments, P.gt ); };


        /*
         * Return a new BigNumber with a random value equal to or greater than 0 and less than 1,
         * and with dp, or DECIMAL_PLACES if dp is omitted, decimal places (or less if trailing
         * zeros are produced).
         *
         * [dp] {number} Decimal places. Integer, 0 to MAX inclusive.
         *
         * 'random() decimal places not an integer: {dp}'
         * 'random() decimal places out of range: {dp}'
         * 'random() crypto unavailable: {crypto}'
         */
        BigNumber.random = (function () {
            var pow2_53 = 0x20000000000000;

            // Return a 53 bit integer n, where 0 <= n < 9007199254740992.
            // Check if Math.random() produces more than 32 bits of randomness.
            // If it does, assume at least 53 bits are produced, otherwise assume at least 30 bits.
            // 0x40000000 is 2^30, 0x800000 is 2^23, 0x1fffff is 2^21 - 1.
            var random53bitInt = (Math.random() * pow2_53) & 0x1fffff
              ? function () { return mathfloor( Math.random() * pow2_53 ); }
              : function () { return ((Math.random() * 0x40000000 | 0) * 0x800000) +
                  (Math.random() * 0x800000 | 0); };

            return function (dp) {
                var a, b, e, k, v,
                    i = 0,
                    c = [],
                    rand = new BigNumber(ONE);

                dp = dp == null || !isValidInt( dp, 0, MAX, 14 ) ? DECIMAL_PLACES : dp | 0;
                k = mathceil( dp / LOG_BASE );

                if (CRYPTO) {

                    // Browsers supporting crypto.getRandomValues.
                    if ( crypto && crypto.getRandomValues ) {

                        a = crypto.getRandomValues( new Uint32Array( k *= 2 ) );

                        for ( ; i < k; ) {

                            // 53 bits:
                            // ((Math.pow(2, 32) - 1) * Math.pow(2, 21)).toString(2)
                            // 11111 11111111 11111111 11111111 11100000 00000000 00000000
                            // ((Math.pow(2, 32) - 1) >>> 11).toString(2)
                            //                                     11111 11111111 11111111
                            // 0x20000 is 2^21.
                            v = a[i] * 0x20000 + (a[i + 1] >>> 11);

                            // Rejection sampling:
                            // 0 <= v < 9007199254740992
                            // Probability that v >= 9e15, is
                            // 7199254740992 / 9007199254740992 ~= 0.0008, i.e. 1 in 1251
                            if ( v >= 9e15 ) {
                                b = crypto.getRandomValues( new Uint32Array(2) );
                                a[i] = b[0];
                                a[i + 1] = b[1];
                            } else {

                                // 0 <= v <= 8999999999999999
                                // 0 <= (v % 1e14) <= 99999999999999
                                c.push( v % 1e14 );
                                i += 2;
                            }
                        }
                        i = k / 2;

                    // Node.js supporting crypto.randomBytes.
                    } else if ( crypto && crypto.randomBytes ) {

                        // buffer
                        a = crypto.randomBytes( k *= 7 );

                        for ( ; i < k; ) {

                            // 0x1000000000000 is 2^48, 0x10000000000 is 2^40
                            // 0x100000000 is 2^32, 0x1000000 is 2^24
                            // 11111 11111111 11111111 11111111 11111111 11111111 11111111
                            // 0 <= v < 9007199254740992
                            v = ( ( a[i] & 31 ) * 0x1000000000000 ) + ( a[i + 1] * 0x10000000000 ) +
                                  ( a[i + 2] * 0x100000000 ) + ( a[i + 3] * 0x1000000 ) +
                                  ( a[i + 4] << 16 ) + ( a[i + 5] << 8 ) + a[i + 6];

                            if ( v >= 9e15 ) {
                                crypto.randomBytes(7).copy( a, i );
                            } else {

                                // 0 <= (v % 1e14) <= 99999999999999
                                c.push( v % 1e14 );
                                i += 7;
                            }
                        }
                        i = k / 7;
                    } else if (ERRORS) {
                        raise( 14, 'crypto unavailable', crypto );
                    }
                }

                // Use Math.random: CRYPTO is false or crypto is unavailable and ERRORS is false.
                if (!i) {

                    for ( ; i < k; ) {
                        v = random53bitInt();
                        if ( v < 9e15 ) c[i++] = v % 1e14;
                    }
                }

                k = c[--i];
                dp %= LOG_BASE;

                // Convert trailing digits to zeros according to dp.
                if ( k && dp ) {
                    v = POWS_TEN[LOG_BASE - dp];
                    c[i] = mathfloor( k / v ) * v;
                }

                // Remove trailing elements which are zero.
                for ( ; c[i] === 0; c.pop(), i-- );

                // Zero?
                if ( i < 0 ) {
                    c = [ e = 0 ];
                } else {

                    // Remove leading elements which are zero and adjust exponent accordingly.
                    for ( e = -1 ; c[0] === 0; c.shift(), e -= LOG_BASE);

                    // Count the digits of the first element of c to determine leading zeros, and...
                    for ( i = 1, v = c[0]; v >= 10; v /= 10, i++);

                    // adjust the exponent accordingly.
                    if ( i < LOG_BASE ) e -= LOG_BASE - i;
                }

                rand.e = e;
                rand.c = c;
                return rand;
            };
        })();


        // PRIVATE FUNCTIONS


        // Convert a numeric string of baseIn to a numeric string of baseOut.
        function convertBase( str, baseOut, baseIn, sign ) {
            var d, e, k, r, x, xc, y,
                i = str.indexOf( '.' ),
                dp = DECIMAL_PLACES,
                rm = ROUNDING_MODE;

            if ( baseIn < 37 ) str = str.toLowerCase();

            // Non-integer.
            if ( i >= 0 ) {
                k = POW_PRECISION;

                // Unlimited precision.
                POW_PRECISION = 0;
                str = str.replace( '.', '' );
                y = new BigNumber(baseIn);
                x = y.pow( str.length - i );
                POW_PRECISION = k;

                // Convert str as if an integer, then restore the fraction part by dividing the
                // result by its base raised to a power.
                y.c = toBaseOut( toFixedPoint( coeffToString( x.c ), x.e ), 10, baseOut );
                y.e = y.c.length;
            }

            // Convert the number as integer.
            xc = toBaseOut( str, baseIn, baseOut );
            e = k = xc.length;

            // Remove trailing zeros.
            for ( ; xc[--k] == 0; xc.pop() );
            if ( !xc[0] ) return '0';

            if ( i < 0 ) {
                --e;
            } else {
                x.c = xc;
                x.e = e;

                // sign is needed for correct rounding.
                x.s = sign;
                x = div( x, y, dp, rm, baseOut );
                xc = x.c;
                r = x.r;
                e = x.e;
            }

            d = e + dp + 1;

            // The rounding digit, i.e. the digit to the right of the digit that may be rounded up.
            i = xc[d];
            k = baseOut / 2;
            r = r || d < 0 || xc[d + 1] != null;

            r = rm < 4 ? ( i != null || r ) && ( rm == 0 || rm == ( x.s < 0 ? 3 : 2 ) )
                       : i > k || i == k &&( rm == 4 || r || rm == 6 && xc[d - 1] & 1 ||
                         rm == ( x.s < 0 ? 8 : 7 ) );

            if ( d < 1 || !xc[0] ) {

                // 1^-dp or 0.
                str = r ? toFixedPoint( '1', -dp ) : '0';
            } else {
        
