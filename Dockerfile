FROM node:6.9

RUN npm install nodemon -g
RUN npm install

CMD npm start
