"use strict";
// Define requestAnimFrame
window.requestAnimFrame = (function(callback) {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
    function(callback) {
    window.setTimeout(callback, 1000 / 60);
    };
})();

/* get canvas element */
let root = document.documentElement;
let canvas = root.querySelector('canvas');
let context = canvas.getContext('2d');

/* window dimensions */
let width = window.innerWidth;
let height = window.innerHeight;  

/* make sure to set the grid size to the shortest dimension, 
I used width and height to make it possible to upgrade the game 
later to fill the screen in mobile version */  
let dimention = Math.min(width, height);
width = dimention;
height = dimention;
canvas.width  = width ;
canvas.height = height;

/* canvas rect object , we will use it to get the mouse position */
let rect;

/* game options, an object of: grid dimention: (number of cells in a row), waiting time: secondes, crazy game: on - off, sound: on-off */
let options = getGameOptions();

/* the margin for the grid inside the canvas */
let margin = 40;

/* Dimensions variables:
    cell's width and height
    dw : The width change rate for each frame
    dh : The height change rate for each frame 
    padding: is the gap between columns and rows
*/
let cellWidth;
let cellHeight;
let dw ;
let dh ;
let padding;

/* Calculate them */ 
calculateDimensions();

/* To determine whether the game is over */
let gameIsOver = false;

/* Mouse position */
let mouseX, mouseY;

/* current frame in the game, we use it in the animations */
let frame = 0;

/* Game colors */
let backgroundColor = '#6B2212';
let textColor = '#D1C17E';
let buttonTextColor = '#ffd41b';
let hoverColor = '#D1C17E';
let startCellColor = 'Maroon';
let pathCellColor = 'Goldenrod';
let rightCellColor = 'green';
let halfrightCellColor = 'cyan';
let wrongCellColor = 'red';

/* Define the buttons object :
    x,y: top left point of the button box
    label: the text to show in the button
    callback: the function to run when the button is pressed
    drawMode: the alignment of the text inside the button box ['left', 'center', 'right']
*/
function Button(x,y,label,callback,drawMode){
    this.x = x;
    this.y = y;
    this.text = label;
    context.font = this.font;
    /* the width of the button is the width of it's label */
    this.width =  context.measureText(this.text).width;
    /* we use offset to test the mouse over state */
    switch(drawMode) {
        case 'center' : this.offset = -this.width/2; break;
        case 'right' : this.offset = -this.width; break;
        case 'left' : 
        default : this.offset = 0; 
    }
    this.callback = callback;
    this.color = buttonTextColor;
}
/* Default buttons height and font type */
Button.prototype.height = 24;
Button.prototype.font = "Bold Italic 20px Comic Sans MS";

/* Determine if the mouse is over the button: 
   check mouseX and mouseY to be inside the button-box 
*/
Button.prototype.checkMouseOver = function(){
    if (this.x+this.offset < mouseX 
        && this.x + this.width + this.offset > mouseX 
        && this.y<mouseY 
        && this.y+this.height > mouseY) {
        this.active = true;
        this.color = hoverColor;
    } else {
        this.active = false;
        this.color = buttonTextColor;
    }
}

/* function to draw the button */
Button.prototype.show = function(){
    context.save();
    context.textBaseline = 'top';
    context.font = this.font;
    context.fillStyle = this.color;
    context.fillText(this.text, this.x+this.offset, this.y);
    context.restore();
}

/* Define the cell object:
   x,y is the top left point
*/
function Cell(x,y){
    this.id = 0;
    this.x = x ;
    this.y = y ;
    /* actual cell left position */
    this._x = x*cellWidth + margin;
    /* actual cell top position : 1.5*margin to make the margin top bigger */
    this._y = y*cellHeight + 1.5 * margin;
    this.width = 0;
    this.height = 0;
    /* we use (visited, weight) when we generate the path */
    this.visited = false;
    this.weight = null;
    /* animation helper */
    this.satartDraw = false;
    this.finishedDraw = false;
    /* events helper */
    this.notClicked = true;
    /* color */
    this.color = startCellColor;
}

/* reset the animation state */
Cell.prototype.reset = function(){
    this.startDraw = false;
    this.finishedDraw = false;
    this.width = 0;
    this.height = 0;
}

/* draw the cell on the canvas */
Cell.prototype.draw = function(){
    /* each time we call draw function we add (dw) to the width until we reach the actual width */
    this.width = (this.width + dw >= cellWidth - 2 * padding)? cellWidth - 2 * padding : this.width + dw; 
    /* each time we call draw function we add (dh) to the height until we reach the actual height */
    this.height = (this.height + dh >= cellHeight - 2 * padding)? cellHeight - 2 * padding : this.height + dh;
    /* start draw */
    /* if the cell is the wrong answer then we draw the 'X' */
    if (this.color !== wrongCellColor) {
        context.fillStyle = this.color;
        context.strokeStyle = '#000';
        context.roundRect(this._x - this.width/2 + cellWidth/2 , 
            this._y - this.height/2 + cellHeight/2, 
            this.width, 
            this.height,
            this.width/8)
            .fill();
        } else {
            context.lineCap = "round" 
            context.lineWidth = this.width/8; 
            context.strokeStyle = '#f00';
            context.drawError(this._x - this.width/2 + cellWidth/2 , 
                this._y - this.height/2 + cellHeight/2, 
                this.width, 
                this.height)
                .stroke();
        }
    /* if we reached the actual dimentions we set finishedDraw to true to stop drawing this cell */
    if (this.width >= cellWidth - 2 * padding && this.height >= cellHeight - 2 * padding) this.finishedDraw = true;
}

/* Determine if the mouse is over the cell: 
   check mouseX and mouseY to be inside the cell-box */
Cell.prototype.checkMouseOver = function(){
    if (this._x < mouseX && this._x + this.width > mouseX 
        && this._y<mouseY && this._y+this.height > mouseY) {
        return true;
    } else {
        return false;
    }
}

/* variables */
/* each scene is a function that draw the current active option */
let scene = [];
/* each element is the buttons inside the current scene */
let buttons  = [];
/* each element is the events to be listen to in the current scene */
let clickEventListener  = [];
/* cells inside the grid */
let cells = [];
/* the path is an array of cell's ids  */
let _path = [];
/* start and end cell - we used a fixed start and end, but we can choose random places */
let startCell;
let endCell;
/* is the game already created */
let gameCreated = false;
/* an array to store the timeout functions ids, to clear them when needed */
let timeOutArray = [];
/* the counter to start the game */
let gameAfter = '';
let gameAfterInterval;
/* is the path drawing is finished */
let pathIsDrawed = false;

/* clear the canvas and redraw the cells */
function drawGrid(){
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    for (let i=0; i<cells.length; i++){
        cells[i].draw();
    }
}
/* draw the path */
function drawPath(){
    /* clear the counter */
    gameAfter = '';
    /* loop through all path cells */
    for (let i=0; i<_path.length; i++){
        let c = cells[_path[i]];
        setTimeout(function(i) {
            c.reset();
            c.color = pathCellColor;
            if (options.sound) aa.play( 'drawCell' );
        }, i*300);
    };
    /* path draw is finished */
    pathIsDrawed = true;
    /* interval for the counter at the top */
    setTimeout(function() {
        gameAfter = options.hideAfter;
        gameAfterInterval = setInterval(function() {
            gameAfter--;
            gameAfter =  (gameAfter>0)? gameAfter : 'Go Back!';
            if (options.sound) aa.play( 'countDown' );
        }, 1000);
    }, _path.length*300);
    /* hide the path after all the cells is finished drawing */
    timeOutArray.push(setTimeout(function() {
        clearInterval(gameAfterInterval);
        gameAfter = 'Go Back!';
        if (options.sound) aa.play( 'startGame' );
        for (let i=0; i<_path.length; i++){
            let c = cells[_path[i]];
            c.reset(_path.length-i);
            c.color = startCellColor;
        };
    }, options.hideAfter*1000 + _path.length*300));
}

/* give cells weights to help us when generating the path 
   the weight of the cell is the distance between it and the end cell

    S | 3 | 3 | 3
    3 | 2 | 2 | 2
    3 | 2 | 1 | 1
    3 | 2 | 1 | E

*/
function setWeights(endCell){
    let x = endCell.x;
    let y = endCell.y;
    let j = Math.max(endCell.x, endCell.y, options.gridDimension - endCell.x, options.gridDimension - endCell.y)+1;
    for (let i=0; i<j; i++){
        let n = [];
        for (let a=-1*i; a<=i; a++){
            for (let b=-1*i; b<=i; b++){
                let c = getCell(x+a,y+b);
                if (c && c.id != endCell.id) n.push(c);
            }
        }
        for (let k=0; k<n.length; k++){
             if(n[k].weight === null) {
                 n[k].weight = i;
             }
        }
    }
}

/* generate the path starting from a cell : we start at the top left (but it can be anywhere)
   we find the neighbours cells, select random one, then generate the path starting from it
   at the end of the path if the the selected cell is not the end cell, then
   we go one step back and select aother cell
   we repeate the selecting until we reach the end cell
*/
function getPath(_cell){
    /* mark the cell as visited to exclude it if we need to */
    _cell.visited = true;
    let nbrs = getNbrs(_cell);
    if (nbrs.length !== 0) {
        let next = nbrs[Math.floor(Math.random() * nbrs.length)];
        _path.push(next.id);
        if (next.weight == 1) {
            return false;
        }
        getPath(next);
    } else {
        let id = _path.pop();
        getPath(cells[id]);
    }
}

/* create new game */
function createGame(){
    /* reset the cell and path array */ 
    cells = [];
    _path = [];
    /* the path is not drawn yet */
    pathIsDrawed = false;
    /* make sure that all timeout functions are cleared */
    for(let i=0; i<timeOutArray.length; i++) clearTimeout(timeOutArray[i]);
    /* generate new cells */
    for (let j=0; j<options.gridDimension; j++){
        for (let i=0; i<options.gridDimension; i++){
            let c = new Cell(i,j);
            c.id = i + j*options.gridDimension;
            cells.push(c);
        }
    }
/* we started at the top left and ended at the bottom right
   but we can start and end randomly    
*/
    startCell = cells[0];
    endCell = cells[cells.length-1];
/* set the options for them */
    startCell.color = 'royalblue';
    endCell.color = 'royalblue';
    startCell.visited = true;
    endCell.visited = true;
    startCell.notClicked = false;
    endCell.notClicked = false;
/* set cells weight depending on the end cell */    
setWeights(endCell);
/* generate a path depending on the end cell */    
    getPath(startCell);
/* game is created */
    gameCreated = true;
}

/* helper functions */

/* clear the background function */
function drawBackground(){
    context.save();
    context.clearRect(0, 0, width, height);
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);
    context.restore();
}

/* draw the buttons of the current scene */
function drawButtons(){
    for (var i=0; i<buttons[currentScene].length; i++){
        buttons[currentScene][i].checkMouseOver();
        buttons[currentScene][i].show();
    }
}

/* extend the canvas to draw a rounded corner rectangle */ 
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x+r, y);
    this.arcTo(x+w, y,   x+w, y+h, r);
    this.arcTo(x+w, y+h, x,   y+h, r);
    this.arcTo(x,   y+h, x,   y,   r);
    this.arcTo(x,   y,   x+w, y,   r);
    this.closePath();
    return this;
}

/* extend the canvas to draw a 'X' sign */
CanvasRenderingContext2D.prototype.drawError = function (x,y,w,h){
    /* dif is a safe space to make sure that the 'X' signs will not touch each other */
    let dif = 5;
    context.beginPath();
    context.moveTo( x+dif   ,y+dif );
    context.lineTo( x+w-dif ,y+h-dif );
    context.moveTo( x+w-dif ,y+dif);
    context.lineTo( x+dif   ,y+h-dif );
    return this;
}

/* save and restore the game options in the local storage */
function setGameOptions(options){
    localStorage.removeItem('ms_gobackgame_options');
    localStorage["ms_gobackgame_options"] = JSON.stringify(options);
}
function getGameOptions(){
    if (localStorage && 'ms_gobackgame_options' in localStorage ) {
        return JSON.parse(localStorage["ms_gobackgame_options"]);
    } else {
        return {
            gridDimension : 4,
            crazy : false,
            hideAfter : 3,
            sound : true
        }
    }
}

/* set the dimensions */
function calculateDimensions(){
    /* Cell width is the canvas width without the margin, divided by the number of cells in the row */
    cellWidth = (width - 2 * margin) / options.gridDimension;
    /* Cell height is the canvas height without the margin, divided by the number of cells in the column */
    cellHeight = (height - 2 * margin) / options.gridDimension;
    /* dw : The width change rate for each frame */
    dw = cellWidth / 10;
    /* dh : The height change rate for each frame  */
    dh = cellHeight / 10;
    /* padding: is the gap between columns and rows */
    padding = cellWidth/25;
}

/* return the cell object by giving it's x,y */
function getCell(i,j){
    if (i<0 || i >= options.gridDimension || j<0 || j >= options.gridDimension) return false;
    return cells[i+j*options.gridDimension];
}

/* get the not visited neighbours of a cell, the neighbours are :
   crazy :      normal:
   x | x | x    - | - | -
   x | C | x    - | C | x
   x | x | x    - | x | x
*/
function getNbrs(_cell){
    let n = [];
    let i = _cell.x;
    let j = _cell.y;
    /* if the game mode is crazy, the neighbours are all around */
    let o = options.crazy? -1 : 0;
    for (let a=o; a<2; a++){
        for (let b=o; b<2; b++){
            let c = getCell(i+a,j+b);
            if (c && c.id != _cell.id) n.push(c);
        }
    }
    /* remove visited cells */
    n = n.filter((_c)=>!_c.visited);
    return n;
}

/* add mouse move event listener to canvas to set the mouse x,y variables */
canvas.addEventListener('mousemove', function(e) {
    rect = canvas.getBoundingClientRect();
    mouseX= e.clientX - rect.left;
    mouseY= e.clientY - rect.top;
    canvas.style.cursor = 'default';
    for (var i=0; i<buttons[currentScene].length; i++){
        /* set the cursor to pointer if over a button */
        if (buttons[currentScene][i].active == true) {
            canvas.style.cursor = 'pointer';
        }
    }
});

/* function to draw a static text */
function renderText(text,c,offsetx,offsety,sz){
    var offsetx,offsety, color, size ;
    offsetx = (offsetx == undefined)? 0 : offsetx;
    offsety = (offsety == undefined)? 0 : offsety;
    color = !c? textColor : c;
    size = (sz == undefined)? 80 : sz;
    context.save();
    context.font = 'bold ' + size + 'px Comic Sans MS';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.fillText(text, offsetx, offsety);
    context.restore();
}

/* function to select another scene */
function changeScene(toScene){
    /* clear intervals */
    clearInterval(gameAfterInterval);
    /* there is no pause in this game, the game must be ended*/
    gameCreated = false;
    /* remove event listener of the previous scene  */ 
    canvas.removeEventListener('click', clickEventListener[currentScene]);
    /* change the scene */
    currentScene = toScene;
    /* add event listener of the current scene  */
    canvas.addEventListener('click', clickEventListener[currentScene]);
}

/* every loop will check if a button is active that means it was clicked */
function checkEvents(){
    for (var i=0; i<buttons[currentScene].length; i++){
            if (buttons[currentScene][i].active == true) {
                buttons[currentScene][i].callback();
                break;
            }
    }
}

let helpText = ['When you start the game,', 
                'a path of yellow cells will be drawn, ',
                'after '+ options.hideAfter +' seconds, it will disappear',
                'you have to go back from the last cell to the first one', 
                'but on the same path', 
                'if you choose the right cell, it will turn to green', 
                'if you choose a cell on the path but not the next one,', 
                'it will turn to light blue',
                'if you choose the wrong one, it will turn to "X"',
                'you can always get a hint .. there is no time limits'
            ];

/* Sences Animations */
/* each one is the function that will be repeated
   clear the background -- render the elements
*/
scene = {
    start :  function(){
        drawBackground();
        renderText('GO BACK!', false, width/2, 140);
        drawButtons();
    },
    help : function(){
        drawBackground();
        renderText('How to play', false, width/2, 100, 60);
        for (let i=0; i<helpText.length; i++){
            renderText(helpText[i], false, width/2, 150 + 25*i, 18);
        }
        drawButtons();
    },
    options : function(){
        drawBackground();
        renderText('Options!', false, width/2, 100);
        renderText('Crazy :', false, width/2 - 30, 200, 20);
        renderText('Grid Size :', false, width/2 - 48, 250, 20);
        renderText(options.gridDimension, false, width/2 + 50, 250, 20);
        renderText('Hide after :', false, width/2 - 54, 300, 20);
        renderText(options.hideAfter + 's', false, width/2 + 50, 300, 20);
        renderText('Sound :', false, width/2 - 30, 350, 20);
        drawButtons();
    },
    play : function(){
        if (!gameCreated) createGame(); else drawGrid();
        if (!pathIsDrawed && cells.every(x=>x.finishedDraw)) drawPath();
        drawButtons();
        renderText(gameAfter,'#555', width/2, 30 , 24);
    }
}

/* the button for each scene 
   each line explain itself : a new button (x, y, label, callback, label draw position)
   in 'options' we need to resave the new values

*/
buttons = {
    start : [
            new Button(width/2,height - 200,'Play', function(){changeScene('play');}, 'center'),
            new Button(width/2,height - 150,'Options', function(){changeScene('options');}, 'center'),
            new Button(width/2,height - 100,'How to play', function(){changeScene('help');}, 'center')    
        ],
    help : [
            new Button(width/2,height - 200,'Play', function(){changeScene('play');}, 'center'),
            new Button(width/2,height - 150,'Option', function(){changeScene('options');}, 'center')
    ],
    options: [
        new Button(width/2,height - 200,'Play', function(){changeScene('play');}, 'center'),
        new Button(width/2,height - 150,'How to play', function(){changeScene('help');}, 'center'),
        new Button(width/2 + 30, 185, options.crazy?'yes':'no', function(){
            options.crazy = !options.crazy;
            this.text = options.crazy?'yes':'no';
            setGameOptions(options);
        }, 'center'),
        new Button(width/2 + 20, 235, '-', function(){
            options.gridDimension = (options.gridDimension-1 < 3)? 3 : options.gridDimension-1;
            calculateDimensions();
            setGameOptions(options);
        }, 'center'),
        new Button(width/2 + 80, 235, '+', function(){
            options.gridDimension++;
            calculateDimensions();
            setGameOptions(options);
        }, 'center'),
        new Button(width/2 + 20, 285, '-', function(){
            options.hideAfter = (options.hideAfter-1 < 2)? 2 : options.hideAfter-1;
            setGameOptions(options);
        }, 'center'),
        new Button(width/2 + 80, 285, '+', function(){
            options.hideAfter = (options.hideAfter+1 > 10)? 10 : options.hideAfter+1;
            setGameOptions(options);
        }, 'center'),
        new Button(width/2 + 30, 335, options.sound?'yes':'no', function(){
            options.sound = !options.sound;
            this.text = options.sound?'yes':'no';
            setGameOptions(options);
        }, 'center'),
    ],
    play : [
        new Button(50, 20,'Options', function(){
            changeScene('options');
        }, 'left'),
        new Button(width - 50, 20,'Hint', function(){
            if(gameAfter !== 'Go Back!') return;
            let c = cells[_path.pop()];
            if (c) {
                c.color = rightCellColor;
                c.notClicked = false;
            } else {
               gameAfter = 'Seriously!!' 
            }
        }, 'right'),
    ]
}

/* the events for each scene 
   the functions are called when we click over the canvas
*/
clickEventListener = {
    start : function(e) {
        checkEvents();
    },
    help : function(e) {
        checkEvents();
    },
    options : function(e) {
        checkEvents();
    },
    play : function(){
        /* check the buttons */
        checkEvents();
        /* check the cells */
        let c = null;
        for (let i=0; i<cells.length; i++){
            if (cells[i].checkMouseOver()) {
               c = cells[i];
               break;
            }
        }
        /* if we click on a cell for the first time */
        if (c && c.notClicked) {
            /* the user must not click before the path is hidden */
            if(gameAfter !== 'Go Back!') return;
            c.notClicked = false;
            /* reset the cell to re draw it */
            c.reset();
            /* check if the cell was on the path in the right order */  
            if (c.id == _path[_path.length-1]) {
                if (options.sound) aa.play( 'right' );
                _path.pop();
                c.color = rightCellColor;
                /* check if the game is over */
                if (_path.length == 0){
                        /* but after drawing the last cell */
                        setTimeout(function() {
                            alert('Well Done! \n try the next Level!');
                            options.gridDimension++;
                            calculateDimensions();
                            setGameOptions(options);
                            createGame();
                        }, 300);
                    }
            } else {
                /* check if the cell on the path but not in the right order */
                if (_path.some(x=>x==c.id)) {
                    if (options.sound) aa.play( 'halfright' );
                    c.color = halfrightCellColor;
                    c.notClicked = true;
                } else {
                    if (options.sound) aa.play( 'wrong' );
                    c.color = wrongCellColor;
                }
            }
        }
    }
};

/* in what scene are we */
let currentScene = 'start';
/* assign the events of the current scene */ 
canvas.addEventListener('click', clickEventListener[currentScene]);

/* animation Function */
function animate() {
    frame++;
    /* run current scene */
    scene[currentScene]();
    /* recall the animation function */
    requestAnimFrame(animate);
}
animate();

/*  add sounds -- http://www.superflashbros.net/as3sfxr/ */

function ArcadeAudio() {
  this.sounds = {};
}

ArcadeAudio.prototype.add = function( key, count, settings ) {
  this.sounds[ key ] = [];
  settings.forEach( function( elem, index ) {
    this.sounds[ key ].push( {
      tick: 0,
      count: count,
      pool: []
    } );
    for( var i = 0; i < count; i++ ) {
      var audio = new Audio();
      audio.src = jsfxr( elem );
      this.sounds[ key ][ index ].pool.push( audio );
    }
  }, this );
};

ArcadeAudio.prototype.play = function( key ) {
  var sound = this.sounds[ key ];
  var soundData = sound.length > 1 ? sound[ Math.floor( Math.random() * sound.length ) ] : sound[ 0 ];
  soundData.pool[ soundData.tick ].play();
  soundData.tick < soundData.count - 1 ? soundData.tick++ : soundData.tick = 0;
};

var aa = new ArcadeAudio();

aa.add( 'right', 10,
  [
    [0,,0.0647,0.3889,0.4497,0.6461,,,,,,0.2855,0.6416,,,,,,1,,,,,0.5]
  ]
);

aa.add( 'halfright', 5,
  [
    [0,0.0312,0.1251,0.3346,0.2725,0.6769,,0.004,0.137,,0.0955,0.0011,0.0612,0.0009,-0.0493,0.0015,0.0605,-0.062,0.9649,-0.035,0.0461,0.0049,0.0184,0.5]
  ]
);

aa.add( 'wrong', 3,
  [
    [2,,0.2298,0.1574,0.3461,0.6438,0.0229,-0.4772,,,,,,0.7991,-0.5284,,0.127,-0.0129,1,,,0.1038,,0.23]
  ]
);

aa.add( 'drawCell', 3,
  [
    [0,,0.0296,0.3414,0.302,0.4656,,,,,,0.5,0.5336,,,,,,1,,,,,0.23]
  ]
);
aa.add( 'countDown', 3,
  [
    [1,,0.2255,,0.2307,0.4077,,0.1789,,,,,,,,0.7881,,,1,,,,,0.23]
  ]
);
aa.add( 'startGame', 3,
  [
    [0,,0.2972,,0.1213,0.4026,,0.4318,,,,,,0.5843,,0.4127,,,1,,,,,0.23]
  ]
);
