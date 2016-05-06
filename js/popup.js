function page_loaded()
{
}
function click_logout_div()
{
	browser.runtime.sendMessage({"command":"logout"});
	window.close();
}
function click_this_user_div(this_account)
{
	browser.runtime.sendMessage({"command":"login","account":this_account});
	window.close();
}
	
function generate_option(this_account)
{
	var this_element = document.createElement("li");
	this_element.setAttribute("class","nohover");
	this_element.id = this_account.site_info.name + this_account.username;
	this_element.innerHTML = '<a href="#' + this_account.site_info.name + '-' + this_account.username + '">' + this_account.username + '</a>';
	this_element.onclick = function (this_account)
	{ 
		return function ()
		{
			click_this_user_div(this_account);
		};
	}(this_account);
	browser.cookies.get({"url":this_account.site_info.cookieurl,"name":this_account.site_info.cookiename}, function (cookie) {
		var saved_uid = cookie.value.split(":")[1];
		if(saved_uid == this_account.uid)
		{
			this_element.setAttribute("class","select");
		}
	});
	return this_element;
}
function accountsort(account_one, account_two)
{
	if(account_one.site_info.name < account_two.site_info.name) return -1;
	else if(account_one.site_info.name > account_two.site_info.name) return 1;
	else if(account_one.username < account_two.username) return -1;
	else if(account_one.username > account_two.username) return 1;
	else return 0;
}
window.onload = function()
{
	// First dynamically build the page.
	browser.runtime.sendMessage({"command":"localStorage","mode":"get","key":"lj_juggler_accounts"}, function (response)
	{
		var account_list = [];
		if(response.value != undefined) account_list = JSON.parse(response.value);
		account_list.sort(accountsort);
		
		var current_site = '';
		for(var i = 0; account_list[i]; i++)
		{
			// If this is the first account from this site, add a heading for the site.
			if(account_list[i].site_info.name != current_site)
			{
				var this_header = document.createElement('div');
				this_header.setAttribute('class','site-label');
				this_header.innerHTML = account_list[i].site_info.name;
				document.getElementById('user_list').appendChild(this_header);
				current_site = account_list[i].site_info.name;
			}
			var next_option = generate_option(account_list[i]);
			document.getElementById("user_list").appendChild(next_option);
		}
		// If all the accounts are from a single site, we can actually remove the site label as extraneous.
//		var kill_me = document.getElementsByClassName('site-label');
//		if(kill_me.length < 2)
//			kill_me[0].parentNode.removeChild(kill_me[0]);
	});

	// Now attach some event handlers.
	document.getElementById('livejournal_logout').onclick = function(evt) {
		click_logout_div();
	}
	document.getElementById('options_page_link').onclick = function() {
		browser.tabs.create({'url': browser.extension.getURL('options.html')});
	}

}
