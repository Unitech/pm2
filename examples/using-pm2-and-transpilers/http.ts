/// <reference path="./node.d.ts" />

/**
 * See the node.js TypeScript definition needed for this
 * example here: https://github.com/borisyankov/DefinitelyTyped
 */

import * as Http from "http";

class MyServer {
  private header:Object = {'Content-Type': 'text/plain'};

  constructor() {
    var server:Http.Server = Http.createServer(this.onRequest);
    server.listen(3000, () => {
      console.log("Server started on port 3000");
    });
  }

  private onRequest(request:Http.ServerRequest, response:Http.ServerResponse):void {
    response.writeHead(200, this.header);
    response.end("Hello TypeScript & node.js");
  }
}

var myServer = new MyServer();
