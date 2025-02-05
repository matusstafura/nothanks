const TEXTAREA = document.querySelector('textarea');

chrome.storage.local.get(['names'], function(result) {
  if (result.names) {
    TEXTAREA.value = result.names;
  }
});

var button = document.querySelector('button');
button.addEventListener("click", setValues);

function setValues() {
  var names = TEXTAREA.value;
  names = cleanNames(names).join("\n");
  chrome.storage.local.set({ 'names': names }, function() {
    console.log("Name saved:", names);
  });
}

// clean from empty lines and duplicates
function cleanNames(names) {
  return names.split("\n")
    .map((name) => name.trim())
    .filter((name) => name.length > 4)
    .filter((name, index, self) => self.indexOf(name) === index);
}

