const fdk=require('@fnproject/fdk');

const sharp = require('sharp');

var fs = require('fs');
var https = require('https');
var httpSignature = require('http-signature');

// TODO: update these values to your own
var tenancyId = "";
var authUserId = "";
var keyFingerprint = "";
var storageDomain = "objectstorage.us-ashburn-1.oraclecloud.com"

// Single Line of Private Key concated with '\n'
var privateKey = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAzYWCT3GkJUuE\n-----END RSA PRIVATE KEY-----";

function sign(request, options) {

  var apiKeyId = options.tenancyId + "/" + options.userId + "/" + options.keyFingerprint;

  var headersToSign = [
      "host",
      "date",
      "(request-target)"
  ];

  var methodsThatRequireExtraHeaders = ["POST", "PUT"];

  if(methodsThatRequireExtraHeaders.indexOf(request.method.toUpperCase()) !== -1) {
      options.body = options.body || "";

      request.setHeader("Content-Length", options.body.length);
  }

  httpSignature.sign(request, {
      key: options.privateKey,
      keyId: apiKeyId,
      headers: headersToSign
  });

  var newAuthHeaderValue = request.getHeader("Authorization").replace("Signature ", "Signature version=\"1\",");
  request.setHeader("Authorization", newAuthHeaderValue);
}

function getObject(input) {
    return new Promise( (resolve, reject) => {
        var options = {
            host: storageDomain,
            path: "/n/" + input.data.additionalDetails.namespace+ "/b/" + input.data.additionalDetails.bucketName + "/o/" + encodeURIComponent(input.data.resourceName),
            method: 'GET'
            };
    
        var request = https.request(options, (response) => {
            var contentType = response.headers['content-type'];
            var buffer = [];
    
            response.on('data', (chunk) => {
                buffer.push( chunk ); 
            });
    
            response.on('end', () => {
                var retarray ={};
                var binary = Buffer.concat(buffer);

                retarray.contentType = contentType;
                retarray.binary = binary;
                resolve(retarray);
            });
        });
    
        sign(request, {
            privateKey: privateKey,
            keyFingerprint: keyFingerprint,
            tenancyId: tenancyId,
            userId: authUserId
        });
        request.on('error', (err) =>{
            console.log(err);
            reject(err);
        });
        request.end();
    });
};

function putObjectData(input, contentType, binary) {
    return new Promise( (resolve, reject) => {
        var body = binary;
        var options = {
            host: storageDomain,
            path: "/n/" + input.data.additionalDetails.namespace+ "/b/small_image/o/small_" + encodeURIComponent(input.data.resourceName),
            method: 'PUT',
            headers: {
               "Content-Type": contentType,
 //              "Content-Type": "image/jpeg",
            }
        };

        var request = https.request(options, (response) => {
            var buffer = [];
            response.on('data', (chunk)=> {
                buffer.push( chunk );                                  
            });
    
            response.on('end', () => {
                resolve(buffer);
            });
        });
    
        sign(request, {
            body: body,
            privateKey: privateKey,
            keyFingerprint: keyFingerprint,
            tenancyId: tenancyId,
            userId: authUserId
        });
        request.on('error', (err) =>{
            reject(err);
        });
        request.end(body);
        
    });       
   };

function run(input) {
    return new Promise((resolve, reject) => {
        getObject(input).then((data) => {
            sharp(data.binary).resize(100,100).toBuffer().then((resized) => {
                    putObjectData(input, data.contentType, resized)
                            .then((data)=>{
                                resolve("put sucess" + data);
                            })
                            .catch((err) => {
                                console.log(err);
                                reject("put failure" + err);
                            });
                                    
                })
                .catch((err) => {
                    console.log(err);
                    reject("resize failure" + err);
                }); 
                                
        })
        .catch((err) => {
            console.log(err);
            reject("get failure" + err);
        });
    });
};

fdk.handle(async function (input, ctx) {

    return run(input);
  
})
