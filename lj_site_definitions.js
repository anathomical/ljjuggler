// Super special thanks to the LJlogin project from which all this information was gleaned.  There were changes made to make this work in Chrome, but hours of research were saved!

var LJlogin_sites = [
	{
		name: 'Dreamwidth',
		domain: '.dreamwidth.org',
		cookieurl: 'https://www.dreamwidth.org/',
		cookiename: 'ljmastersession',
		interfaceurl: 'https://www.dreamwidth.org/interface/flat',
	},
	{
		name: 'LiveJournal',
		domain: '.livejournal.com',
		cookieurl: 'https://www.livejournal.com/',
		cookiename: 'ljmastersession',
		interfaceurl: 'https://www.livejournal.com/interface/flat',
	},
	{
		name: 'InsaneJournal',
		domain: '.insanejournal.com',
		cookieurl: 'http://www.insanejournal.com/',
		cookiename: 'ljmastersession',
		interfaceurl: 'http://www.insanejournal.com/interface/flat',
	},
	{
		name: 'Scribbld',
		domain: '.scribbld.com',
		cookieurl: 'http://www.scribbld.com/',
		cookiename: 'ljmastersession',
		interfaceurl: 'http://www.scribbld.com/interface/flat',
	}
];

// Build a key-based look-up for the above data

var LJlogin_keys = {};
for (var i = 0; i < LJlogin_sites.length; i++) {
	LJlogin_keys[LJlogin_sites[i].name] = LJlogin_sites[i];
}
