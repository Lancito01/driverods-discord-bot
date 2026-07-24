#!/bin/bash

npm run build
while true; do
    npm start #"$1" #? Replace 'your_script.js' with the path to your Node.js script and pass the first argument
done
