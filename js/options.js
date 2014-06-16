function drawlist()
{
	chrome.extension.sendRequest({"command":"localStorage","mode":"get","key":"lj_juggler_accounts"}, function (response)
	{
		var account_list = new Array;
		if(response.value) account_list = JSON.parse(response.value);
		account_list.sort(accountsort);
		document.getElementById("account-list").innerHTML = "";

		current_site = "";		
		for(var i = 0; i < account_list.length; i++)
		{
			// If this is the first account from this site, add a heading for the site.
			if(account_list[i].site_info.name != current_site)
			{
				var this_header = document.createElement('div');
				this_header.setAttribute('class','site-label');
				this_header.innerHTML = account_list[i].site_info.name;
				document.getElementById('account-list').appendChild(this_header);
				current_site = account_list[i].site_info.name;
			}
			var account = account_list[i];
			var next_account = document.createElement("li");
			var delete_button = document.createElement("button");
			delete_button.id = account.username;
			delete_button.onclick = delete_clicker(account);
			next_account.innerHTML = account.username;
			next_account.appendChild(delete_button);
			document.getElementById("account-list").appendChild(next_account);
		}
		
		document.getElementById("new_account").addEventListener('submit', function(event) {
			event.preventDefault();
			save_new_account();
		});
		
		chrome.extension.sendRequest({"command":"localStorage","mode":"get","key":"login_action"}, function (response) {
			document.getElementById("login_action").value = response.value;
		});
		document.getElementById("login_action").addEventListener('change', function(event) {
			chrome.extension.sendRequest({"command":"localStorage","mode":"set","key":"login_action","value":event.target.value});
		});
		
		document.getElementById("username").focus();
	});
}
function delete_clicker (account)
{
	return function ()
	{
		if(confirm("Are you sure you want to delete the account " + account.username + " from LJ Juggler?")) delete_account(account.username);
	};
}
function delete_account(username)
{
	chrome.extension.sendRequest({"command":"localStorage","mode":"get","key":"lj_juggler_accounts"}, function (response)
	{
		var account_list = JSON.parse(response.value);
		for (var i = 0; account_list[i]; i++)
		{
			if (account_list[i].username == username)
			{
				account_list.splice(i, 1);
				chrome.extension.sendRequest({"command":"localStorage","mode":"set","key":"lj_juggler_accounts","value":JSON.stringify(account_list)});
				break;
			}
		}
		drawlist();
	});
}
function save_new_account()
{
	var username = document.getElementById("username").value;
	var password = md5(document.getElementById("password").value);
	var site_info_index = document.getElementById("sitedropdown").value;
	if(username && password)
	{
		chrome.extension.sendRequest({"command":"login","account":{"username":username,"password":password,"site_info":LJlogin_sites[site_info_index]}}, function (response)
		{
			if(response.code == "ok")
			{
				var uid = response.uid;
				chrome.extension.sendRequest({"command":"localStorage","mode":"get","key":"lj_juggler_accounts"}, function (response)
				{
					var account_list = [];
					if(response.value) account_list = JSON.parse(response.value);
					account_to_add = {"username":username,"password":password,"uid":uid,"site_info":LJlogin_sites[site_info_index]};
					account_list.push(account_to_add);
					chrome.extension.sendRequest({"command":"localStorage","mode":"set","key":"lj_juggler_accounts","value":JSON.stringify(account_list)}, function (response) { drawlist(); });
				});
			}
			else alert("There was an error confirming the account " + username + ".  The error message received was: " + response.message);
		});
	}
	document.getElementById("username").value = "";
	document.getElementById("password").value = "";
	return false;
}
function initialize()
{
	for(var i = 0; i < LJlogin_sites.length; i++)
	{
		var site = LJlogin_sites[i];
		var next_option = document.createElement("option");
		next_option.value = i;
		next_option.innerHTML = site.name;
		document.getElementById("sitedropdown").appendChild(next_option);
	}
	drawlist();
}
function accountsort(account_one, account_two)
{
	if(account_one.site_info.name < account_two.site_info.name) return -1;
	else if(account_one.site_info.name > account_two.site_info.name) return 1;
	else if(account_one.username < account_two.username) return -1;
	else if(account_one.username > account_two.username) return 1;
	else return 0;
}
window.onload=function() { initialize(); };