'use strict';

var nconf = require('nconf');
var winston = require('winston');
var validator = require('validator');

exports.handleURIErrors = function (err, req, res, next) {
	// Handle cases where malformed URIs are passed in
	if (err instanceof URIError) {
		var tidMatch = req.path.match(/^\/topic\/(\d+)\//);
		var cidMatch = req.path.match(/^\/category\/(\d+)\//);

		if (tidMatch) {
			res.redirect(nconf.get('relative_path') + tidMatch[0]);
		} else if (cidMatch) {
			res.redirect(nconf.get('relative_path') + cidMatch[0]);
		} else {
			winston.warn('[controller] Bad request: ' + req.path);
			if (req.path.startsWith(nconf.get('relative_path') + '/api')) {
				res.status(400).json({
					error: '[[global:400.title]]',
				});
			} else {
				var middleware = require('../middleware');
				middleware.buildHeader(req, res, function () {
					res.status(400).render('400', { error: validator.escape(String(err.message)) });
				});
			}
		}
	} else {
		next(err);
	}
};

// this needs to have four arguments or express treats it as `(req, res, next)`
// don't remove `next`!
exports.handleErrors = function (err, req, res, next) { // eslint-disable-line no-unused-vars
	switch (err.code) {
	case 'EBADCSRFTOKEN':
		winston.error(req.path + '\n', err.message);
		return res.sendStatus(403);
	case 'blacklisted-ip':
		return res.status(403).type('text/plain').send(err.message);
	}

	var status = parseInt(err.status, 10);
	if ((status === 302 || status === 308) && err.path) {
		return res.locals.isAPI ? res.status(status).json(err.path) : res.redirect(err.path);
	}

	winston.error(req.path + '\n', err.stack);

	res.status(status || 500);

	var path = String(req.path || '');
	if (res.locals.isAPI) {
		res.json({ path: validator.escape(path), error: err.message });
	} else {
		var middleware = require('../middleware');
		middleware.buildHeader(req, res, function () {
			res.render('500', { path: validator.escape(path), error: validator.escape(String(err.message)) });
		});
	}
};
