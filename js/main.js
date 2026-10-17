(function(){
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function pitch(cv, opts){
    var c = cv.getContext('2d'), W = cv.width, H = cv.height, t = 0;
    var home = [], away = [];
    for (var i=0;i<6;i++){ home.push({x:.15+.12*(i%3), y:.25+.25*Math.floor(i/3)+.1*(i%2), p:Math.random()*6}); away.push({x:.85-.12*(i%3), y:.3+.22*Math.floor(i/3)+.1*(i%2), p:Math.random()*6}); }
    function draw(){
      var stripes = 10;
      for (var s=0;s<stripes;s++){ c.fillStyle = s%2 ? '#2f8a4e' : '#2a7d47'; c.fillRect(s*W/stripes,0,W/stripes+1,H); }
      c.strokeStyle='rgba(255,255,255,.75)'; c.lineWidth=Math.max(2,W/300);
      var m = W*.04; c.strokeRect(m,m,W-2*m,H-2*m);
      c.beginPath(); c.moveTo(W/2,m); c.lineTo(W/2,H-m); c.stroke();
      c.beginPath(); c.arc(W/2,H/2,H*.14,0,7); c.stroke();
      c.strokeRect(m,H*.3,W*.12,H*.4); c.strokeRect(W-m-W*.12,H*.3,W*.12,H*.4);
      var bx = .5+.3*Math.sin(t*.7), by = .5+.25*Math.sin(t*1.1);
      function team(arr,col){ arr.forEach(function(p){ var x=(p.x*.7+bx*.3+.03*Math.sin(t+p.p))*W, y=(p.y*.7+by*.3+.03*Math.cos(t*1.3+p.p))*H; c.fillStyle='rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x+2,y+4,W*.012,W*.006,0,0,7); c.fill(); c.fillStyle=col; c.beginPath(); c.arc(x,y,W*.012,0,7); c.fill(); c.strokeStyle='#fff'; c.lineWidth=2; c.stroke(); }); }
      team(home,'#e8b84a'); team(away,'#3d6bff');
      c.fillStyle='#fff'; c.beginPath(); c.arc(bx*W,by*H,W*.007,0,7); c.fill();
      if (!reduce) { t += .016; requestAnimationFrame(draw); }
    }
    draw();
  }
  pitch(document.getElementById('match'));
  pitch(document.getElementById('mini'));

  var feed = ["Kick-off at El Predio. The stands are filling up.","23' Long ball over the top… GOAL! Barrio FC lead.","31' VAR check on the goal… it stands!","38' Power cut! The floodlights flicker.","44' Flares in the home end. The referee waits.","67' Penalty to Deportivo Sur… saved!","90' Full time. The barrio goes wild."];
  var score = ["0 – 0","1 – 0","1 – 0","1 – 0","1 – 0","1 – 0","1 – 0"], mins=["12'","23'","31'","38'","44'","67'","90'"], i=0;
  if (!reduce) setInterval(function(){ i=(i+1)%feed.length; document.getElementById('feed').textContent=feed[i]; document.getElementById('sc').textContent=score[i]; document.getElementById('mn').textContent=mins[i]; }, 2600);

  var w = document.getElementById('wave');
  for (var k=0;k<36;k++){ var b=document.createElement('i'); b.style.height=(12+Math.abs(Math.sin(k*.6))*70)+'px'; w.appendChild(b); }
  if (!reduce) { var bars=w.children, tt=0; (function anim(){ tt+=.05; for (var j=0;j<bars.length;j++) bars[j].style.height=(10+Math.abs(Math.sin(j*.5+tt)*Math.cos(j*.17+tt*.6))*90)+'px'; requestAnimationFrame(anim); })(); }
})();
