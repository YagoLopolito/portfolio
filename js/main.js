(function(){
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Synesthesia card: animated equaliser bars.
  var w = document.getElementById('wave');
  for (var k=0;k<36;k++){ var b=document.createElement('i'); b.style.height=(12+Math.abs(Math.sin(k*.6))*70)+'px'; w.appendChild(b); }
  if (!reduce) { var bars=w.children, tt=0; (function anim(){ tt+=.05; for (var j=0;j<bars.length;j++) bars[j].style.height=(10+Math.abs(Math.sin(j*.5+tt)*Math.cos(j*.17+tt*.6))*90)+'px'; requestAnimationFrame(anim); })(); }

  // Screenshot lightbox. <dialog> gives Esc-to-close, focus containment and focus return for free.
  var box = document.getElementById('lightbox');
  var img = box.querySelector('img'), cap = box.querySelector('figcaption');
  document.addEventListener('click', function(e){
    var shot = e.target.closest('.shot');
    if (!shot) return;
    var thumb = shot.querySelector('img');
    img.src = shot.dataset.full;
    img.alt = thumb.alt;
    cap.textContent = shot.dataset.caption || '';
    box.showModal();
  });
  box.querySelector('.lb-close').addEventListener('click', function(){ box.close(); });
  // Click on the backdrop (outside the dialog box) closes it.
  box.addEventListener('click', function(e){
    var r = box.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) box.close();
  });
  box.addEventListener('close', function(){ img.removeAttribute('src'); });

  // Copy-to-clipboard for the contact email; the address stays selectable text as a fallback.
  document.querySelectorAll('.copy').forEach(function(btn){
    var status = btn.parentNode.querySelector('.copied');
    btn.addEventListener('click', function(){
      var done = function(msg){ status.textContent = msg; setTimeout(function(){ status.textContent = ''; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(btn.dataset.copy).then(function(){ done('Copied'); }, function(){ done('Select and copy the address'); });
      else done('Select and copy the address');
    });
  });
})();
