function page_loaded()
{
	browser.runtime.onMessage.addListener(
		function(request, sender, sendResponse)
		{
			if(request.command == "logout")
			{
				console.log("Logging out...");
				for(var i = 0; i < LJlogin_sites.length; i++)
				{
				browser.cookies.get({"url":LJlogin_sites[i].cookieurl,"name":LJlogin_sites[i].cookiename}, function(cookie)
					{
						logout_this_cookie(cookie);
					});
				}
				sendResponse({});
			}
			else if(request.command == "login")
			{
				console.log("Logging in as... " + request.account.username);
				browser.cookies.get({"url":request.account.site_info.cookieurl,"name":request.account.site_info.cookiename}, function(cookie) {
					logout_this_cookie(cookie);
					
					// Due to LiveJournal.com's new system for cookies, we have to parse out the uid from the set cookie rather than from the response, which requires an override here.
					if(request.account.site_info.name == "LiveJournal")
					{
						var response_to_send = parse_lj_response(loginas(request.account));
						browser.cookies.get({"url":request.account.site_info.cookieurl, "name":"ljmastersession"}, function(cookie){
							console.log(cookie);
							console.log(response_to_send);
							response_to_send.uid = cookie.value.split(":")[1];
							sendResponse(response_to_send);
						});
					}
					else
					{
						var response_to_send = parse_lj_response(loginas(request.account));
						sendResponse(response_to_send);
					}
				});
				return true;
			}
			else if(request.command == "localStorage")
			{
				console.log("localStorage access request received in mode: " + request.mode + " for key: " + request.key);
				if(request.mode == "set")
				{
					localStorage[request.key] = request.value;
					sendResponse({"code":"ok"});
				}
				else if(request.mode == "removeItem")
				{
					localStorage.removeItem(request.key);
					sendResponse({"code":"ok"});
				}
				else if(request.mode == "get")
				{
					sendResponse({"code":"ok","value":localStorage[request.key]});
				}
			}
		});
		browser.cookies.onChanged.addListener(function (changeInfo)
		{
			if(!changeInfo.removed && changeInfo.cookie.name == "BMLschemepref" && changeInfo.cookie.session)
			{
				console.log("Detected BMLschemepref.  Converting from session-length to 365-day length cookie.");
				var now = new Date();
				delete changeInfo.cookie.hostOnly;
				delete changeInfo.cookie.session;
				changeInfo.cookie.expirationDate = (+new Date() / 1000) + (60*60*24*365);
				changeInfo.cookie.url = "http" + (changeInfo.cookie.secure ? "s" : "") + "://" + changeInfo.cookie.domain.substring(1) + changeInfo.cookie.path;
				browser.cookies.set(changeInfo.cookie);
			}			
		});
}
function getLJchallenge(interface_url)
{
	console.log("Getting challenge from interface: " + interface_url);
	var conn = new XMLHttpRequest();
	var params = "mode=getchallenge";
	conn.open("POST",interface_url,false);
	conn.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
	conn.send(params);
	var challenge = conn.responseText.split("\n")[3];
	return challenge;
}
function loginas(this_account)
{
	var conn = new XMLHttpRequest();
	console.log("Beginning the login dance...");
	var challenge = getLJchallenge(this_account.site_info.interfaceurl);
	var response = md5(challenge + this_account.password);
	var params = "mode=sessiongenerate" +
				"&user=" + this_account.username +
				"&auth_method=challenge" +
				"&auth_challenge=" + challenge +
				"&auth_response=" + response;
	// Due to a change in LiveJournal.com's cookie handling, we have to do this hacky login in order to hit up cookie headers directly
	if(this_account.site_info.name == 'LiveJournal')
	{
		params = "user=" + this_account.username +
				"&chal=" + challenge +
				"&response=" + response +
				"&remember_me=1";
		conn.open("POST", "http://www.livejournal.com/login.bml", false);
	}
	// All other implementations of LJ code seem to use the documented behavior, so this works just fine.
	else
		conn.open("POST", this_account.site_info.interfaceurl, false);
	conn.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
	conn.send(params);
	console.log("Login negotiations completed.  Saving session data.");
	
	// Now let's see what we're supposed to do post-login, and then do that
	console.log("RELOAD?");
	if (localStorage["login_action"] == "current") {
		browser.tabs.getSelected(function(tab) {
			if (new RegExp(this_account.site_info.domain).test(tab.url)) browser.tabs.reload(tab.id);
		});
	}
	else if (localStorage["login_action"] == "all") {
		browser.tabs.query({"url":"*://*" + this_account.site_info.domain + "/*"}, function(tabs) {
			tabs.forEach(function (tab) {
				browser.tabs.reload(tab.id);
			});
		});
	}
	
	return save_cookie_data(this_account, conn);
}
function save_cookie_data(this_account, conn)
{
	// Due to an undocumented change in the way LiveJournal.com handles cookies, they have to be parsed in a completely different manner.  Yay.
	if(this_account.site_info.name == 'LiveJournal')
	{
		// We've hit /login.bml directly, so the cookies have now set themselves.  (All of them, not just the login ones, nothing breaks, but ugh is it inefficient.)

		// We do need to manually extract the cookies so that we can get the user's uid.
		browser.cookies.get({"url":this_account.site_info.cookieurl, "name":"ljmastersession"}, function(cookie){
			this_account.uid = cookie.value.split(":")[1];
			update_account(this_account);
		});
	}
	else
	{
		// Process standard LJ code, which isn't used by LiveJournal.com anymore.
		var ljsession = conn.responseText.split("\n")[1];
		var ljloggedin = ljsession.split(":")[1] + ":" + ljsession.split(":")[2];

		var now = +new Date() / 1000;
		browser.cookies.set({"url":this_account.site_info.cookieurl, "domain":this_account.site_info.domain, "name":this_account.site_info.cookiename, "value":ljsession, "expirationDate":(now + 60*60*24*365)});
		browser.cookies.set({"url":this_account.site_info.cookieurl, "domain":this_account.site_info.domain, "name":"ljloggedin", "value":ljloggedin, "expirationDate":(now + 60*60*24*365)});
		this_account.uid = ljsession.split(":")[1];
		update_account(this_account);
	}
	return conn.responseText;
}
function parse_lj_response(response_text)
{
	console.log("Parsing response from LJ to pass back to the calling page...");
	var lj_response_lines = response_text.split("\n");
	var response_to_return = {};
	if(lj_response_lines[0] == "errmsg") response_to_return.code = "error";
	else response_to_return.code = "ok";
	response_to_return.request = lj_response_lines[1];
	try
	{
		response_to_return.uid = lj_response_lines[1].split(":")[1];
	}
	catch (e)
	{
		response_to_return.uid = "";
	}
	return response_to_return;
}
function logout_this_cookie(cookie)
{
	if(cookie != undefined)
	{
		console.log("Logout subroutine started...");
		try
		{
			var cookie_fields = cookie.value.split(":");
			var sessid = cookie_fields[2].substring(1);
			conn = new XMLHttpRequest()
			var params = "mode=sessionexpire" +
						"&auth_method=cookie" +
						"&expire_id_" + sessid + "=1";
			conn.open("POST", get_interface_url_from_cookie(cookie),false);
			conn.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
			conn.setRequestHeader("X-LJ-Auth","cookie");
			conn.send(params);
		}
		catch (e)
		{
			console.log("logout failure: " + e);
		}
		console.log("Deleting cookie...");
		browser.cookies.remove({"url":"http://www" + cookie.domain + cookie.path,"name":"ljsession"});
		browser.cookies.remove({"url":"http://www" + cookie.domain + cookie.path,"name":"ljloggedin"});
		browser.cookies.remove({"url":"http://www" + cookie.domain + cookie.path,"name":"ljmastersession"});
	}
	else console.log("No cookie found, no need to log out.");
}
function get_interface_url_from_cookie(cookie)
{
	console.log("Finding proper interface url to log this cookie out...");
	for(var i = 0; i < LJlogin_sites.length; i++)
	{
		console.log("Checking " + cookie.domain + " against " + LJlogin_sites[i].domain);
		if(cookie.domain == LJlogin_sites[i].domain)
		{
			return LJlogin_sites[i].interfaceurl;
		}
	}
	return false;
}
function update_account(change_me)
{
	console.log("Updating account: " + change_me.username);
        console.log("Local Storage: ", localStorage["lj_juggler_accounts"]);
	var stored_account_data = localStorage["lj_juggler_accounts"];
                if (stored_account_data) {
                    var account_list = JSON.parse(stored_account_data);
        }       else {
                    var account_list = [];
        }
	for(var i = 0; i < account_list.length; i++)
	{
		if(account_list[i].username == change_me.username && account_list[i].site_info == change_me.site_info) account_list[i] = change_me;
	}	
	localStorage["lj_juggler_accounts"] = JSON.stringify(account_list);
}
function find_in_array(array, value)
{
	if(array)
	{
		for(var i = 0; i < array.length; i++)
		{
			if(value == array[i]) return true;
		}
	}
	return false
}
window.onload=function() { page_loaded(); };
