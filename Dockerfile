FROM node:4.4

RUN npm install nodemon -g
RUN npm install

CMD npm start