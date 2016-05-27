function page_loaded()
{
	update_check();
	chrome.runtime.onMessage.addListener(
		function(request, sender, sendResponse)
		{
			if(request.command == "logout")
			{
				console.log("Logging out...");
				for(var i = 0; i < LJlogin_sites.length; i++)
				{
					chrome.cookies.get({"url":LJlogin_sites[i].cookieurl,"name":LJlogin_sites[i].cookiename}, function(cookie)
					{
						logout_this_cookie(cookie);
					});
				}
			}
			else if(request.command == "login" || request.command == "newAccount")
			{
				console.log("Logging in as... " + request.account.username);
				chrome.cookies.get({"url":request.account.site_info.cookieurl,"name":request.account.site_info.cookiename}, function(cookie) {
					logout_this_cookie(cookie, function() {
						loginas(request.account, function (response) {
							if (request.command == "newAccount") {
								var split_response_text = response.responseText.split("\n");
								if (split_response_text[0] == "errmsg") {
									sendResponse(split_response_text[1]);
								}
								else {
									chrome.cookies.get({"url":request.account.site_info.cookieurl,"name":request.account.site_info.cookiename}, function (cookie) {
										var uid = cookie.value.split(":")[1];
										account_to_add = {"username":request.account.username,"password":request.account.password,"uid":uid,"site_info":request.account.site_info};
										var account_list = JSON.parse(localStorage["lj_juggler_accounts"]);
										account_list.push(account_to_add);
										localStorage["lj_juggler_accounts"] = JSON.stringify(account_list);
										sendResponse("ok");
									});
								}
							}
						});
					});
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
		chrome.cookies.onChanged.addListener(function (changeInfo)
		{
			if(!changeInfo.removed && changeInfo.cookie.name == "BMLschemepref" && changeInfo.cookie.session)
			{
				console.log("Detected BMLschemepref.  Converting from session-length to 365-day length cookie.");
				var now = new Date();
				delete changeInfo.cookie.hostOnly;
				delete changeInfo.cookie.session;
				changeInfo.cookie.expirationDate = (+new Date() / 1000) + (60*60*24*365);
				changeInfo.cookie.url = "http" + (changeInfo.cookie.secure ? "s" : "") + "://" + changeInfo.cookie.domain.substring(1) + changeInfo.cookie.path;
				chrome.cookies.set(changeInfo.cookie);
			}			
		});
}
function getLJchallenge(interface_url, callback)
{
	console.log("Getting challenge from interface: " + interface_url);
	var conn = new XMLHttpRequest();
	var params = "mode=getchallenge";
	conn.open("POST",interface_url,true);
	conn.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
	conn.onreadystatechange = function() {
		if (conn.readyState == 4 && conn.status == 200) getLJchallenge_callback(callback, conn);
	};
	conn.send(params);
}
function getLJchallenge_callback(callback, conn) {
	var challenge = conn.responseText.split("\n")[3];
	if (callback) callback(challenge);
}
function loginas(this_account, callback)
{
	var conn = new XMLHttpRequest();
	console.log("Beginning the login dance...");
	getLJchallenge(this_account.site_info.interfaceurl, function (challenge) {
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
			conn.open("POST", "http://www.livejournal.com/login.bml", true);
		}
		// All other implementations of LJ code seem to use the documented behavior, so this works just fine.
		else
			conn.open("POST", this_account.site_info.interfaceurl, true);
		conn.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
		conn.onreadystatechange = function() {
			if (conn.readyState == 4 && conn.status == 200) loginas_callback(this_account, callback, conn);
		};
		conn.send(params);
	});
}
function loginas_callback (this_account, callback, conn) {
	console.log("Login negotiations completed.  Saving session data.");
	
	// Now let's see what we're supposed to do post-login, and then do that
	console.log("RELOAD?");
	if (localStorage["login_action"] == "current") {
        chrome.tabs.query({active: true, currentWindow: true, "url":"*://*" + this_account.site_info.domain + "/*"}, function(tab) {
                chrome.tabs.reload(tab.id);
                });
        }
	else if (localStorage["login_action"] == "all") {
		chrome.tabs.query({"url":"*://*" + this_account.site_info.domain + "/*"}, function(tabs) {
			tabs.forEach(function (tab) {
				chrome.tabs.reload(tab.id);
			});
		});
	}
	
	save_cookie_data(this_account, conn);
	if (callback) callback(conn);
}
function save_cookie_data(this_account, conn)
{
	// Due to an undocumented change in the way LiveJournal.com handles cookies, they have to be parsed in a completely different manner.  Yay.
	if(this_account.site_info.name == 'LiveJournal')
	{
		// We've hit /login.bml directly, so the cookies have now set themselves.  (All of them, not just the login ones, nothing breaks, but ugh is it inefficient.)

		// We do need to manually extract the cookies so that we can get the user's uid.
		chrome.cookies.get({"url":this_account.site_info.cookieurl, "name":"ljmastersession"}, function(cookie){
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
		chrome.cookies.set({"url":this_account.site_info.cookieurl, "domain":this_account.site_info.domain, "name":this_account.site_info.cookiename, "value":ljsession, "expirationDate":(now + 60*60*24*365)});
		chrome.cookies.set({"url":this_account.site_info.cookieurl, "domain":this_account.site_info.domain, "name":"ljloggedin", "value":ljloggedin, "expirationDate":(now + 60*60*24*365)});
		this_account.uid = ljsession.split(":")[1];
		update_account(this_account);
	}
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
function logout_this_cookie(cookie, callback)
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
			conn.open("POST", get_interface_url_from_cookie(cookie),true);
			conn.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
			conn.setRequestHeader("X-LJ-Auth","cookie");
			conn.onreadystatechange = function() {
				if (conn.readyState == 4 && conn.status == 200) logout_this_cookie_callback(cookie, callback, conn);
			};
			conn.send(params);
		}
		catch (e)
		{
			console.log("logout failure: " + e);
			if (callback) callback();
		}
	}
	else {
		console.log("No cookie found, no need to log out.");
		if (callback) callback();
	}
}
function logout_this_cookie_callback(cookie, callback, conn) {
	console.log("Deleting cookie...");
	chrome.cookies.remove({"url":"http://www" + cookie.domain + cookie.path,"name":"ljsession"});
	chrome.cookies.remove({"url":"http://www" + cookie.domain + cookie.path,"name":"ljloggedin"});
	chrome.cookies.remove({"url":"http://www" + cookie.domain + cookie.path,"name":"ljmastersession"});
	if (callback) callback(conn);

}
function get_interface_url_from_cookie(cookie)
{
	console.log("Finding proper interface url to log this cookie out...");
	for(var i = 0; i < LJlogin_sites.length; i++)
	{
		console.log("Checking " + cookie.domain + " against " + LJlogin_sites[i].domain);
		if(cookie.domain.indexOf(LJlogin_sites[i].domain) > -1)
		{
			return LJlogin_sites[i].interfaceurl;
		}
	}
	return false;
}
function update_account(change_me)
{
	console.log("Updating account: " + change_me.username);
        var stored_account_data = localStorage["lj_juggler_accounts"];
                if (stored_account_data) {
                    var account_list = JSON.parse(stored_account_data);
        }       else {
                    var account_list = [];
        }   
        localStorage["lj_juggler_accounts"] = JSON.stringify(account_list);
}
function update_check()
{
	var current_version = getVersion(function (current_version) {
		var old_version = localStorage["lj_juggler_version"];
		console.log("checking version - current: " + current_version + " - stored: " + old_version);
		if(old_version != current_version)
		{
			console.log("Versions don't match, executing updates...");
			version_update(old_version, current_version);
		}
		else console.log("Data structures up to date");
	});
}
function getVersion(callback)
{
	var conn = new XMLHttpRequest();
	conn.open('GET', chrome.extension.getURL('manifest.json'), true);
	conn.onreadystatechange = function() {
		console.log(conn);
		var manifest = JSON.parse(conn.responseText);
		if (conn.readyState == 4 && conn.status == 200 && callback) callback(manifest.version);
	};
	conn.send(null);
}
function version_update(old_version, current_version)
{
	chrome.tabs.create({'url': "http://rushin-doll.net/lj-juggler/change-log.html"});
	localStorage["lj_juggler_version"] = current_version;
	var version_history_list = [];
	console.log("retrieve version history list from localStorage");
	if(localStorage["version_history_list"] != undefined)
	{
		try
		{
			version_history_list = JSON.parse(localStorage["version_history_list"]);
		}
		catch (e)
		{
			version_history_list = [localStorage["version_history_list"]];
		}
	}

	console.log("run updates in order");

	console.log("updating version_history_list in localStorage: " + version_history_list);
	localStorage["version_history_list"] = JSON.stringify(version_history_list);
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
