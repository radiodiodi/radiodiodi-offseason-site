(function() {
    var accordionElements = document.getElementsByClassName("accordion");

    for (var i = 0; i < accordionElements.length; i++) {
        accordionElements[i].onclick = function(){
            this.classList.toggle("active");
            this.nextElementSibling.classList.toggle("show");
        }
    }
})();

/**
 * https://gist.github.com/juusaw/c52f4addcdb4b2875d14fc9525197cd5
 */

var links = document.getElementsByClassName('scroll-link');

for (var i = 0; i < links.length; i++) {
    links[i].onclick = scroll;
}

function scroll(e) {
    e.preventDefault();
    var id = this.getAttribute('href').replace('#', '');
    var target = document.getElementById(id).getBoundingClientRect().top;
    animateScroll(target);
}

function animateScroll(targetHeight) {
    targetHeight = document.body.scrollHeight - window.innerHeight > targetHeight + scrollY ? 
        targetHeight : document.body.scrollHeight - window.innerHeight;
    var initialPosition = window.scrollY;
    var SCROLL_DURATION = 30;
    var step_x = Math.PI / SCROLL_DURATION;
    var step_count = 0;
    requestAnimationFrame(step);
    function step() {
        if (step_count < SCROLL_DURATION) {
            requestAnimationFrame(step);
            step_count++;
            window.scrollTo(0, initialPosition + targetHeight * 0.25 * Math.pow((1 - Math.cos(step_x * step_count)), 2));
        }
    }
}

function updateChart(back) {
    var addHtml = '';
    var index = back ?
        programChart.selectedDate - 1:
        programChart.selectedDate + 1;

    if (programChart.programme[index]) {
        programChart.selectedDate = index;
        programChart.programme[index].forEach(function(p) {
            addHtml += '<div class="chart-show">' +
                            '<small>' + p.start.substr(11, 5) + ' - ' + p.end.substr(11, 5) + '</small>' +
                                '<p>' + p.title + '</p>' +
                                '<p>' + p.by + '</p>' +
                            '</div>';
        });
        document.getElementById('next-day').innerHTML = addHtml;
    }
};

var chartForward = function() { updateChart(false); };
var chartBack = function() { updateChart(true); };

document.getElementById('programme-next-day').onclick = chartForward;
document.getElementById('programme-prev-day').onclick = chartBack;