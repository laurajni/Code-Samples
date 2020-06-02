/**
 * Receives a query object as parameter and sends it as Ajax request to the POST /query REST endpoint.
 *
 * @param query The query object
 * @returns {Promise} Promise that must be fulfilled if the Ajax request is successful and be rejected otherwise.
 */
 
CampusExplorer.sendQuery = function (query) {
    return new Promise(function (fulfill, reject) {
        let request = new XMLHttpRequest();
        request.open("POST", "/query");
        request.setRequestHeader("Content-Type", "application/json");
        request.onload = function () {
            if (this.status === 200) {
                fulfill(JSON.parse(this.responseText));
            } else {
                reject(JSON.parse(this.responseText));
            }
        };
        request.onerror = function (err) {
            reject(JSON.parse(this.responseText));
        };
        request.send(JSON.stringify(query));
    });
};
