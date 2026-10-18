export default {
	outdir: './src/lib/paraglide',
	emitTsDeclarations: true,
	outputStructure: 'message-modules',
	strategy: ['cookie', 'baseLocale'],
	cookieName: 'santa_language',
	cookieMaxAge: 60 * 60 * 24 * 365,
	cookieSameSite: 'lax',
	cookieSecure: 'auto'
};
