FROM node:20-alpine
WORKDIR /app
RUN printf '%s\n' \
  'const http=require("http");' \
  'const port=process.env.PORT||8080;' \
  'http.createServer((req,res)=>{' \
  '  res.writeHead(410,{"Content-Type":"application/json"});' \
  '  res.end(JSON.stringify({error:"Workshop OS API moved to Firebase Firestore. Use the static web app."}));' \
  '}).listen(port,"0.0.0.0",()=>console.log("legacy stub on",port));' \
  > server.js
ENV PORT=8080
EXPOSE 8080
CMD ["node","server.js"]
