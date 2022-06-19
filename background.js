let isSaveUserdata = true;
let username = '';
let password = '';

browser.browserAction.onClicked.addListener((id)=>{
    browser.tabs.create({ url: "links/index.htm" });
});

browser.runtime.onMessage.addListener(
    function(message, sender, sendResponse) {
        if (message == null || message.type == null) {
            return;
        }
        switch (message.type) {
            case 'set_userdata': {
                isSaveUserdata = true;
                if (message.username != '' && message.password != '') {
                    username = message.username;
                    password = message.password;
                }
                sendResponse();
                break;
            }
            case 'get_userdata': {
                sendResponse({ username: username, password: password, flag: isSaveUserdata });
                break;
            }
            case 'clear_userdata': {
                username = '';
                password = '';
                isSaveUserdata = false;
                sendResponse();
                break;
            }
            case 'get_stands': {
                console.log("1")
                let standList = JSON.parse(window.localStorage.getItem('stands'));
                let thisStandName = message.host.split('.')[2];
                if (standList == null) {
                    standList = [
                        {
                            name: thisStandName,
                            host: message.host
                        }
                    ];
                    window.localStorage.setItem('stands', JSON.stringify(standList));
                }
                if (standList.filter(e => e.name === thisStandName).length == 0) {
                    standList.push(
                        {
                            name: thisStandName,
                            host: message.host
                        }
                    );
                    window.localStorage.setItem('stands', JSON.stringify(standList));
                }
                sendResponse({ stands: standList });
                break;
            }
        }
    }
);
