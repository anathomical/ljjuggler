	// function to change the theme and remember the setting in local storage
function setTheme() {
	let color = document.getElementById("theme").value;
	let bodyElement = document.getElementsByTagName("body")[0];

	bodyElement.className = color;
	return color
}

function saveThemeChoice(color) {
	chrome.runtime.sendMessage({"command":"localStorage","mode":"set","key":"theme","value":color})
}

// function to export accounts to file
function exportAccounts() {
	chrome.runtime.sendMessage({"command":"localStorage","mode":"get","key":"lj_juggler_accounts"}, function (list)
	{
		let accounts = new Blob([JSON.stringify(list.value)], {type: 'application/json;base64'});
		let url = URL.createObjectURL(accounts);

	chrome.downloads.download({
		url: url,
		filename: 'juggler_accounts.json'
	});
});
}

// functions to import account list saved as json file
function handleFile() {
	let file = document.getElementById("browse").files[0]
	let reader = new FileReader();
	reader.onload = importAccounts;
	reader.readAsText(file);
}
function importAccounts()	{
		let json = JSON.parse(this.result);
		chrome.runtime.sendMessage({"command":"localStorage","mode":"set","key":"lj_juggler_accounts","value":json});
		drawlist();
		document.getElementById("browse").value = '';
	}

function drawlist()
{
	chrome.runtime.sendMessage({"command":"localStorage","mode":"get","key":"lj_juggler_accounts"}, function (response)
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
				this_header.textContent = account_list[i].site_info.name;
				document.getElementById('account-list').appendChild(this_header);
				current_site = account_list[i].site_info.name;
			}
			var account = account_list[i];
			var next_account = document.createElement("li");
			var delete_button = document.createElement("button");
			delete_button.id = account.username;
			delete_button.onclick = delete_clicker(account);
			next_account.textContent = account.username;
			next_account.appendChild(delete_button);
			document.getElementById("account-list").appendChild(next_account);
		}

		document.getElementById("new_account").addEventListener('submit', function(event) {
			event.preventDefault();
			save_new_account();
		});
		chrome.runtime.sendMessage({"command":"localStorage","mode":"get","key":"login_action"}, function (response) {
			document.getElementById("login_action").value = response.value;
		});
		document.getElementById("login_action").addEventListener('change', function(event) {

                        chrome.runtime.sendMessage({"command":"localStorage","mode":"set","key":"login_action","value":event.target.value});
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
	chrome.runtime.sendMessage({"command":"localStorage","mode":"get","key":"lj_juggler_accounts"}, function (response)
	{
		var account_list = JSON.parse(response.value);
		for (var i = 0; account_list[i]; i++)
		{
			if (account_list[i].username == username)
			{
				account_list.splice(i, 1);
				chrome.runtime.sendMessage({"command":"localStorage","mode":"set","key":"lj_juggler_accounts","value":JSON.stringify(account_list)});
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
		chrome.runtime.sendMessage({"command":"newAccount","account":{"username":username,"password":password,"site_info":LJlogin_sites[site_info_index]}}, function (response)
		{
			if(response == "ok")
			{
				drawlist();
			}
			else {
				alert("There was an error confirming the account " + username + ".  This is usually caused by a typo in username or password, or picking the wrong site in the dropdown.");
			}
		});
	}
	document.getElementById("username").value = "";
	document.getElementById("password").value = "";
	return false;
}
function initialize()
{
	chrome.runtime.sendMessage({"command":"localStorage","mode":"get","key":"theme"}, function (response) {document.getElementById("theme").value = response.value
	setTheme();
	})
	for(var i = 0; i < LJlogin_sites.length; i++)
	{
		var site = LJlogin_sites[i];
		var next_option = document.createElement("option");
		next_option.value = i;
		next_option.textContent = site.name;
		document.getElementById("sitedropdown").appendChild(next_option);
	}
	drawlist();
	// listeners for when theme change, export, and import buttons are clicked
	document.getElementById("subtheme").addEventListener('click', function() {
		let color = setTheme();
		saveThemeChoice(color);
	})
	document.getElementById("export").addEventListener('click', function() {
		exportAccounts();
	})

	document.getElementById("import").addEventListener('click', function() {
		handleFile();
	})
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
