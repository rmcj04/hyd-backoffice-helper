chrome.runtime.onMessage.addListener((request, sender, sendResponse)=> {

    if (request.notifyTitle && request.notifyMessage){

        let notId = Math.random() * 104

        chrome.notifications.create(`bhelper-${notId}`, {
            title: `Backoffice Helper | ${request.notifyTitle}`,
            iconUrl: "/icons/128.png",
            message: request.notifyMessage,
            contextMessage: request.notifyMessage,
            type: "basic"
        });

        sendResponse(true);
    }



    sendResponse(false);
    return true;
});