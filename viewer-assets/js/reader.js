/* global jQuery, _ */

var PCCViewer = window.PCCViewer || {};

(function($, undefined) {
    'use strict';
    
    // Use this key to get or set the viewer object associated with DOM element in which the viewer is embedded.
    var DATAKEY = "PCCViewer.Viewer";
    
    // onWindowResize
    // Attach the supplied callback to jQuery's window resize event.
    // The callback is debounced at 300ms. This means that the callback
    // will be called only one time for any sequence of resize events where
    // each happens within 300ms of the previous event.
    function onWindowResize (callback, store) {
        var timeout;

        var debouncedCallback = function () {
            if (timeout) {
                clearTimeout(timeout);
            }

            timeout = setTimeout(callback, 300);
        };

        $(window).on('resize', debouncedCallback);
        
        if (store && typeof store.push === 'function') { 
            store.push(debouncedCallback); 
        }
        
        return debouncedCallback;
    }
    
    function Viewer(element, options) {
        var viewer = this,
            viewerTemplate = _.template(options.template.viewer),
            nodes = {},
            windowResizeCallbacks = [];

        viewer.viewerNodes = nodes;
        viewer.resizeCallbacks = windowResizeCallbacks;
        viewer.language = options.language;
        viewer.annotationId = options.annotationID || undefined;
        viewer.options = options;
        
        // embed the tempalte into the element
        nodes.$dom = $(element).html(viewerTemplate({
            language: options.language
        }));
        
        // find the viewer node in the template
        nodes.$viewer = nodes.$dom.find('[data-pcc-pagelist]');
        nodes.$menuTrigger = nodes.$dom.find('[data-pcc-menu]');
        nodes.$menu = nodes.$dom.find('[data-pcc-menu-dropdown]');
        
        nodes.$firstPage = nodes.$dom.find("[data-pcc-first-page]");
        nodes.$prevPage = nodes.$dom.find("[data-pcc-prev-page]");
        nodes.$nextPage = nodes.$dom.find("[data-pcc-next-page]");
        nodes.$lastPage = nodes.$dom.find("[data-pcc-last-page]");
        nodes.$pageInput = nodes.$dom.find('[data-pcc-pageSelect]');
        nodes.$pageCount = nodes.$dom.find('[data-pcc-pageCount]');
        nodes.$fitToWidth = nodes.$dom.find("[data-pcc-fit-to-width]");
        
        nodes.$searchToolbar = nodes.$dom.find('[data-pcc-search=toolbar]');
        nodes.$searchNavPrev = nodes.$dom.find('[data-pcc-search-prev]');
        nodes.$searchNavNext = nodes.$dom.find('[data-pcc-search-next]');
        nodes.$searchCurrentResult = nodes.$dom.find('[data-pcc-search-result-display]');
        nodes.$searchResultList = nodes.$dom.find('[data-pcc-search-results-list]');
        nodes.$searchButton = nodes.$dom.find('[data-pcc-search-button]');
        nodes.$searchTrigger = nodes.$dom.find('[data-pcc-search=search]');
        nodes.$searchBack = nodes.$dom.find('[data-pcc-search=back]');
        nodes.$searchClearTrigger = nodes.$dom.find('[data-pcc-search=clear]');
        nodes.$searchBox = nodes.$dom.find('[data-pcc-search-box]');
        nodes.$searchResultsPanel = nodes.$dom.find('[data-pcc-search=list]');
        nodes.$searchResultsToggle = nodes.$dom.find('[data-pcc-search=list-toggle]');
        nodes.$searchToolbar = nodes.$dom.find('[data-pcc-search=toolbar]');
        nodes.$searchProgress = nodes.$dom.find('[data-pcc-search=progress]');
        
        nodes.$thumbnailPanel = nodes.$dom.find('[data-pcc-thumbnails]');
        nodes.$thumbnailButton = nodes.$dom.find('[data-pcc-toggle=dialog-thumbnails]');
        
        nodes.$zoomIn = nodes.$dom.find('[data-pcc-zoom-in]');
        nodes.$zoomOut = nodes.$dom.find('[data-pcc-zoom-out]');

        nodes.$panTool = nodes.$dom.find('[data-pcc-mouse-tool*="AccusoftPanAndEdit"]');
        nodes.$toolTextSelect = nodes.$dom.find('[data-pcc-mouse-tool=AccusoftSelectText]');
        nodes.$toolHighlight = nodes.$dom.find('[data-pcc-mouse-tool=AccusoftHighlightAnnotation]');
        
        nodes.$selectedMarksMenu = nodes.$dom.find('[data-pcc-helper=menu]');
        nodes.$copyButton = nodes.$dom.find('[data-pcc-helper=copy]');
        nodes.$deleteButton = nodes.$dom.find('[data-pcc-helper=delete]');
        
        nodes.$copyModal = nodes.$dom.find('[data-pcc-copy=overlay]');
        nodes.$copyClose = nodes.$dom.find('[data-pcc-copy=close]');
        nodes.$copyInput = nodes.$dom.find('[data-pcc-copy=input]');

        // override options for the bookreader
        options.viewMode = PCCViewer.ViewMode.SinglePage;
        options.maxOutOfViewDisplay = options.maxOutOfViewDisplay || 1;
        options.maxPrefetch = options.maxPrefetch || 1;
        
        // embed the ViewerControl
        var viewerControl = new PCCViewer.ViewerControl(nodes.$viewer.get(0), options);
        viewer.viewerControl = viewerControl;

        function onViewerReady() {
            viewerControl.off(PCCViewer.EventType.ViewerReady, onViewerReady);
            
            viewerControl.fitContent(PCCViewer.FitType.FullPage);
            
            onWindowResize(function(){
                viewerControl.fitContent(PCCViewer.FitType.FullPage);
            });
            
            viewer.touchManager.init();
            
            // The menu is showing by default. We will hide it soon after the viewer
            // is initialized, so the user knows where the extra buttons are, but they 
            // are automatically taken out of the way.
            viewer.controlsManager.hideMenu();
        }

        function onPageCountReady(ev) {
            viewerControl.off(PCCViewer.EventType.PageCountReady, onPageCountReady);
        
            viewer.viewerNodes.$pageCount
                .empty()
                .append(document.createTextNode(ev.pageCount));
        }
        
        viewerControl.on(PCCViewer.EventType.ViewerReady, onViewerReady);
        viewerControl.on(PCCViewer.EventType.PageCountReady, onPageCountReady);
        
        // initialize modules
        this.controlsManager = initControls(viewer);
        this.thumbnailManager = initThumbnails(viewer);
        this.searchManager = initSearch(viewer);
        this.markupManager = initMarkup(viewer);
        this.touchManager = initTouchNav(viewer);
        
        this.onDestroy = function(){
            viewerControl.off(PCCViewer.EventType.ViewerReady, onViewerReady);
            viewerControl.off(PCCViewer.EventType.PageCountReady, onPageCountReady);
            
            // destroy all modules
            this.controlsManager.destroy();
            this.thumbnailManager.destroy();
            this.searchManager.destroy();
            this.markupManager.destroy();
            this.touchManager.destroy();
            
            this.onDestroy = undefined;
        };
    }

    function initControls(viewer) {
        var controls_el = $('.main-dropdown-menu').find('button'),
            lastSelectedText = '';
        
        function changeToFirstPage(){
            viewer.viewerControl.changeToFirstPage();
        }

        function changeToPrevPage(){
            viewer.viewerControl.changeToPrevPage();
        }

        function changeToNextPage(){
            viewer.viewerControl.changeToNextPage();
        }

        function changeToLastPage(){
            viewer.viewerControl.changeToLastPage();
        }
        
        function toggleMenu(){
            viewer.viewerNodes.$menu.toggleClass('menu-closed');
        }
        function hideMenu(){
            viewer.viewerNodes.$menu.addClass('menu-closed');
        }
        
        function onPageInput(ev) {
            var $target = $(ev.target),
                val = $target.val(),
                pageNum = Number(val);
            
            $target.removeClass('pcc-error');
            
            if (pageNum && pageNum > 0 && pageNum <= viewer.viewerControl.getPageCount()) {
                viewer.viewerControl.setPageNumber(pageNum);
            } else {
                $target.val(viewer.viewerControl.getPageNumber()).addClass('pcc-error');
                
                setTimeout(function(){
                    $target.removeClass('pcc-error');
                }, 2000);
            }
        }
        
        function handlePageChanged(ev) {
            viewer.viewerNodes.$pageInput.val(ev.pageNumber);
        }
        function handleMarkSelection(ev) {
            var selectedMarks = viewer.viewerControl.getSelectedMarks();
            
            if (selectedMarks.length) {
                $(viewer.viewerNodes.$copyButton).hide();
                $(viewer.viewerNodes.$deleteButton).show();
                openSelectedMarksMenu();
            } else {
                hideSelectedMarksMenu();
            }
        }
        function handleTextSelection(ev) {
            $(viewer.viewerNodes.$copyButton).show();
            $(viewer.viewerNodes.$deleteButton).hide();
            lastSelectedText = ev.selectedText;
            openSelectedMarksMenu();
        }
        
        function openCopy() {
            function showModal() {
                viewer.viewerNodes.$copyModal.css('display', 'block');
                var cleanText = lastSelectedText.replace(/\n/g, ' ').replace(/[\s]{2,}/g, ' ');
                viewer.viewerNodes.$copyInput.val(cleanText).select();
            }

            if (lastSelectedText) {
                hideSelectedMarksMenu();

                try {
                    if (document.queryCommandSupported && document.queryCommandSupported("cut")) {
                        var accessToClipboardGranted = true;
                        // IE8 - 10 will prompt the user for access
                        if (document.documentMode && document.documentMode >= 8 && document.documentMode <= 10) {
                            accessToClipboardGranted = document.execCommand("cut");
                        }

                        // Now we can show the modal for a brief moment and copy the contents to the clipboard
                        // This will/should happen so fast that the user will never get to see the modal
                        showModal();

                        // Let's check if the cut command worked by checking if the text area has not text in it
                        if (accessToClipboardGranted && document.execCommand("cut") && !viewer.viewerNodes.$copyInput.val().length) {
                            viewer.viewerNodes.$copyModal.hide();
                            return;
                        }
                    }
                } catch (e) {

                }

                showModal();
            }
        }
        function closeCopy() {
            lastSelectedText = '';
            viewer.viewerNodes.$copyModal.css('display', '');
            hideSelectedMarksMenu();
        }
        
        function deleteSelectedMarks() {
            var selectedMarks = viewer.viewerControl.getSelectedMarks();
            
            if (selectedMarks.length) {
                viewer.viewerControl.deleteMarks(selectedMarks);
            }
        }

        function hideSelectedMarksMenu(){
            viewer.viewerNodes.$selectedMarksMenu.stop(true,true).slideUp();
        }


        function openSelectedMarksMenu(){
            viewer.viewerNodes.$selectedMarksMenu.stop(true,true).slideDown();
        }

        function zoomIn(){
            if (!viewer.viewerNodes.$zoomIn.hasClass('pcc-disabled')) {
                viewer.viewerControl.zoomIn(1.25);
            }
        }

        function zoomOut(){
            if (!viewer.viewerNodes.$zoomOut.hasClass('pcc-disabled')) {
                viewer.viewerControl.zoomOut(1.25);
            }
        }

        // Fit Document to Width button
        function fitToWidth() {
            if (viewer.activeFitType !== PCCViewer.FitType.FullPage) {
                viewer.activeFitType = PCCViewer.FitType.FullPage;
                viewer.viewerNodes.$fitToWidth.addClass('pcc-active');
                if (viewer.uiMouseToolName === 'AccusoftSelectToZoom') {
                    viewer.setMouseTool({ mouseToolName: 'AccusoftPanAndEdit' });
                }
                viewer.viewerControl.fitContent(viewer.activeFitType);
            } else {
                viewer.activeFitType = undefined;
                viewer.viewerNodes.$fitToWidth.removeClass('pcc-active');
            }
        }

        function changeMouseTool(ev) {
            var $target = $(ev.currentTarget),
                tool = $target.data('pccMouseTool');
            if (tool) {
                viewer.viewerControl.setCurrentMouseTool(tool);
            }
            toggleActive($target);
        }

        function changePanTool(e){
            if (viewer.viewerControl.getCurrentMouseTool() === 'AccusoftHighlightAnnotation'){
                viewer.viewerNodes.$panTool.trigger('click');
            }
        }

        function toggleActive(el){
            controls_el.removeClass('pcc-active');
            el.addClass('pcc-active');
        }

        function attachEvents(){
            viewer.viewerNodes.$firstPage.on('click', changeToFirstPage);
            viewer.viewerNodes.$prevPage.on('click', changeToPrevPage);
            viewer.viewerNodes.$nextPage.on('click', changeToNextPage);
            viewer.viewerNodes.$lastPage.on('click', changeToLastPage);
            viewer.viewerNodes.$menuTrigger.on('click', toggleMenu);
            viewer.viewerNodes.$zoomIn.on('click', zoomIn);
            viewer.viewerNodes.$zoomOut.on('click', zoomOut);
            viewer.viewerNodes.$pageInput.on('change', onPageInput);
            viewer.viewerNodes.$fitToWidth.on('click', fitToWidth);
            viewer.viewerNodes.$panTool.on('click', changeMouseTool);
            viewer.viewerNodes.$toolTextSelect.on('click', changeMouseTool);
            viewer.viewerNodes.$toolHighlight.on('click', changeMouseTool);
            viewer.viewerNodes.$deleteButton.on('click', deleteSelectedMarks);
            viewer.viewerNodes.$copyButton.on('click', openCopy);
            viewer.viewerNodes.$copyClose.on('click', closeCopy);
            viewer.viewerNodes.$viewer.on('mouseup', changePanTool);
            viewer.viewerControl.on(PCCViewer.EventType.PageChanged, handlePageChanged);
            viewer.viewerControl.on(PCCViewer.EventType.TextSelected, handleTextSelection);
            viewer.viewerControl.on(PCCViewer.EventType.MarkSelectionChanged, handleMarkSelection);
            // remove the copy button on any of these events
            viewer.viewerControl.on(PCCViewer.EventType.MarkCreated, closeCopy);
            viewer.viewerControl.on(PCCViewer.EventType.MouseToolChanged, closeCopy);
        }

        function detachEvents(){
            viewer.viewerNodes.$firstPage.off('click', changeToFirstPage);
            viewer.viewerNodes.$prevPage.off('click', changeToPrevPage);
            viewer.viewerNodes.$nextPage.off('click', changeToNextPage);
            viewer.viewerNodes.$lastPage.off('click', changeToLastPage);
            viewer.viewerNodes.$menuTrigger.off('click', toggleMenu);
            viewer.viewerNodes.$zoomIn.off('click', zoomIn);
            viewer.viewerNodes.$zoomOut.off('click', zoomOut);
            viewer.viewerNodes.$pageInput.off('change', onPageInput);
            viewer.viewerNodes.$fitToWidth.off('click', fitToWidth);
            viewer.viewerNodes.$panTool.off('click', changeMouseTool);
            viewer.viewerNodes.$toolTextSelect.off('click', changeMouseTool);
            viewer.viewerNodes.$toolHighlight.off('click', changeMouseTool);
            viewer.viewerNodes.$deleteButton.off('click', deleteSelectedMarks);
            viewer.viewerNodes.$copyButton.off('click', openCopy);
            viewer.viewerNodes.$copyClose.off('click', closeCopy);
            viewer.viewerNodes.$viewer.off('mouseup', changePanTool);
            viewer.viewerControl.off(PCCViewer.EventType.PageChanged, handlePageChanged);
            viewer.viewerControl.off(PCCViewer.EventType.TextSelected, handleTextSelection);
            viewer.viewerControl.off(PCCViewer.EventType.MarkSelectionChanged, handleMarkSelection);
            viewer.viewerControl.off(PCCViewer.EventType.MarkCreated, closeCopy);
            viewer.viewerControl.off(PCCViewer.EventType.MouseToolChanged, closeCopy);
        }

        function destroy() {
            detachEvents();
        }

        attachEvents();
        
        return {
            destroy: destroy,
            toggleMenu: toggleMenu,
            hideMenu: hideMenu
        };
    }
    
    function initMarkup(viewer) {
        //You can enable saving of the annotations by adding new event types to markEvents array
        //Possible values are:
        // PCCViewer.EventType.MarkCreated,
        // PCCViewer.EventType.MarkChanged,
        // PCCViewer.EventType.MarkRemoved,
        // PCCViewer.EventType.MarkReordered
        var markEvents = [
            PCCViewer.EventType.MarkCreated,
            PCCViewer.EventType.MarkChanged,
            PCCViewer.EventType.MarkRemoved,
            PCCViewer.EventType.MarkReordered
        ],
            markupName = viewer.annotationId,
            savePending = false,
            saveQueue;
        
        function onSaveDone() {
            savePending = false;
            
            if (saveQueue) {
                saveQueue();
                saveQueue = undefined;
            }
        }
        
        function onMarkEvent(ev) {
            if (savePending) {
                saveQueue = onMarkEvent;
            } else {
                savePending = true;
                
                viewer.viewerControl.saveMarkup(markupName)
                .then(function success(){
                    onSaveDone();
                }, function failure(reason){
                    onSaveDone();
                });
            }
        }
        
        function attachEvents() {
            _.forEach(markEvents, function(name){
                viewer.viewerControl.on(name, onMarkEvent);
            });
        }
        function detachEvents() {
            _.forEach(markEvents, function(name){
                viewer.viewerControl.off(name, onMarkEvent);
            });
        }
        
        function init() {
            viewer.viewerControl.loadMarkup(markupName)
            .then(function success(){
                attachEvents();
            }, function failure(reason){
                attachEvents();
            });
        }
        
        function destroy() {
            detachEvents();
        }
        
        // only init this module if an annotation ID is specified
        if (markupName) {
            init();
        }
        
        return {
            destroy: destroy
        };
    }

    function initSearch(viewer) {
        
        function onButtonClick() {
            viewer.controlsManager.toggleMenu();
            showToolbar(function(){
                viewer.viewerNodes.$searchBox.focus();
            });
        }
        
        function onSearch(ev) {
            if (ev.type === 'keypress' && ev.which !== 13) { return; }

            var val = viewer.viewerNodes.$searchBox.blur().val();
            
            if (val) {
                viewer.search(val);
            }
        }
        function onClearSearch() {
            viewer.viewerControl.clearSearch();
        }
        function onBack() {
            hideToolbar();
            onClearSearch();
            viewer.controlsManager.toggleMenu();
        }
        
        function toggleResultsList() {
            viewer.viewerNodes.$searchResultsPanel.toggleClass('pcc-show');
        }
        function hideResultsList() {
            viewer.viewerNodes.$searchResultsPanel.removeClass('pcc-show');
        }
        
        function attachEvents() {
            viewer.viewerNodes.$searchButton.on('click', onButtonClick);
            viewer.viewerNodes.$searchTrigger.on('click', onSearch);
            viewer.viewerNodes.$searchClearTrigger.on('click', onClearSearch);
            viewer.viewerNodes.$searchBack.on('click', onBack);
            viewer.viewerNodes.$searchResultsToggle.on('click', toggleResultsList);
            viewer.viewerNodes.$searchBox.on('keypress', onSearch);
        }
        function detachEvents() {
            viewer.viewerNodes.$searchButton.off('click', onButtonClick);
            viewer.viewerNodes.$searchTrigger.off('click', onSearch);
            viewer.viewerNodes.$searchClearTrigger.off('click', onClearSearch);
            viewer.viewerNodes.$searchBack.off('click', onBack);
            viewer.viewerNodes.$searchResultsToggle.off('click', toggleResultsList);
            viewer.viewerNodes.$searchBox.off('keypress', onSearch);
        }
        
        function showToolbar(done) {
            done = done || function(){};
            
            if (viewer.viewerNodes.$searchToolbar.hasClass('pcc-show')) {
                done();
                return;
            }

            var transitionTimeout;
            function onTransitionEnd(){
                if (transitionTimeout) {
                    clearTimeout(transitionTimeout);
                }
                viewer.viewerNodes.$searchToolbar.off('transitionend', onTransitionEnd);
                
                done();
            }
            
            // just in case we do not have transitions
            transitionTimeout = setTimeout(onTransitionEnd, 500);
            
            viewer.viewerNodes.$searchToolbar.on('transitionend', onTransitionEnd);
            viewer.viewerNodes.$searchToolbar.addClass('pcc-show');
        }
        
        function hideToolbar() {
            viewer.viewerNodes.$searchToolbar.removeClass('pcc-show');
        }
        
        function destroy() {
            detachEvents();
        }
        
        attachEvents();
        
        return {
            destroy: destroy,
            show: showToolbar,
            hide: hideToolbar,
            hideList: hideResultsList
        };
    }
    
    function initThumbnails(viewer) {
        var viewerControl = viewer.viewerControl,
            domElement = viewer.viewerNodes.$thumbnailPanel.get(0),
            thumbnailControl,
            ready = false,
            isShown = false,
            readyQueue = [];

        function onReady(func){
            if (ready) {
                func();
            } else {
                readyQueue.push(func);
            }
        }
        function flushReadyQueue() {
            _.forEach(readyQueue, function(func){
                func();
            });
        }
        
        function showPanel() {
            viewer.viewerNodes.$thumbnailPanel.addClass('pcc-show');
            
            onReady(function(){
                thumbnailControl.reflow();
                thumbnailControl.setSelectedPages(viewerControl.getPageNumber());
            });
            isShown = true;
        }
        function hidePanel() {
            viewer.viewerNodes.$thumbnailPanel.removeClass('pcc-show');
            isShown = false;
        }

        function togglePanel(){
            if (isShown) { hidePanel(); }
            else { showPanel(); }
        }

        function attachEvents() {
            viewer.viewerNodes.$thumbnailButton.on('click', togglePanel);
            viewer.viewerNodes.$thumbnailPanel.on('click', hidePanel);
            viewer.viewerNodes.$menuTrigger.on('click', hidePanel);
        }
        function detachEvents() {
            viewer.viewerNodes.$thumbnailButton.off('click', togglePanel);
            viewer.viewerNodes.$thumbnailPanel.off('click', hidePanel);
            viewer.viewerNodes.$menuTrigger.off('click', hidePanel);
        }

        function destroy() {
            ready = false;
            detachEvents();
            thumbnailControl.off(PCCViewer.ThumbnailControl.EventType.PageSelectionChanged, onSelectionChanged);
            thumbnailControl.destroy();

        }
        
        function onSelectionChanged(ev) {
            viewerControl.setPageNumber(ev.pageNumbers[0]);
        }
        
        viewerControl.on(PCCViewer.EventType.ViewerReady, function() {
            thumbnailControl = new PCCViewer.ThumbnailControl(domElement, viewerControl);
            
            // scroll the viewer whenever the user selects a new page
            thumbnailControl.on(PCCViewer.ThumbnailControl.EventType.PageSelectionChanged, onSelectionChanged);
            
            ready = true;
            flushReadyQueue();
        });

        attachEvents();

        return {
            show: showPanel,
            hide: hidePanel,
            destroy: destroy
        };
    }
    
    function initTouchNav(viewer) {
        var evName = (window.navigator.pointerEnabled) ? {
            start: 'pointerdown',
            move: 'pointermove',
            end: 'pointerup'
        } : (window.navigator.msPointerEnabled) ? {
            start: 'MSPointerDown',
            move: 'MSPointerMove',
            end: 'MSPointerUp'
        } : {
            start: 'touchstart',
            move: 'touchmove',
            end: 'touchend'
        };
        
        var pointerIds = [],
            pointerList = [];
        
        function normalizeEvent(ev){
            if (ev.originalEvent.changedTouches) {
                ev.clientX = ev.originalEvent.changedTouches[0].clientX;
                ev.clientY = ev.originalEvent.changedTouches[0].clientY;
                ev.touches = (ev.originalEvent.touches.length > ev.originalEvent.changedTouches.length) ?
                              ev.originalEvent.touches : ev.originalEvent.changedTouches;
            } else if (/pointer/i.test(ev.type)) {
                ev.clientX = ev.originalEvent.clientX;
                ev.clientY = ev.originalEvent.clientY;
                
                // IE fires 1 event per touch, so we need to keep track of the active touchlist
                if (_.contains(pointerIds, ev.originalEvent.pointerId)) {
                    // this is a touch update
                    pointerList = _.map(pointerList, function(pointer){
                        return (pointer.originalEvent.pointerId === ev.originalEvent.pointerId) ? ev : pointer;
                    });
                } else {
                    // this is a new touch
                    pointerList.push(ev);
                    pointerIds.push(ev.originalEvent.pointerId);
                }
                
                ev.touches = ev.originalEvent.pointerType === 'touch' ? pointerList : undefined;
            }

            return ev;
        }
        
        var scrollDom;
        
        function getPageScrollPosition() {
            var rect = scrollDom.getBoundingClientRect(),
                offsetWidth = rect.width || rect.right - rect.left,
                scrollLeft = scrollDom.scrollLeft,
                scrollWidth = scrollDom.scrollWidth;
            
            return {
                offsetWidth: offsetWidth,
                scrollLeft: scrollLeft,
                scrollWidth: scrollWidth,
                atLeft: scrollLeft === 0,
                // IE has some decimal place issues
                atRight: scrollLeft + offsetWidth >= scrollWidth - 1,
            };
        }
        
        var initPosition,
            initScroll;
        
        function onTouchStart(ev) {
            ev = normalizeEvent(ev);
            
            // account for early exit conditions
            if (!/panandedit/i.test(viewer.viewerControl.getCurrentMouseTool())) { return; }
            if (!ev.touches) { return; }
            
            if (ev.touches.length > 1) {
                onTouchEnd();
                return;
            }
            
            var scrollPosition = getPageScrollPosition();
            
            if (!scrollPosition.atLeft && !scrollPosition.atRight) {
                return;
            }
            
            initPosition = ev;
            initScroll = scrollPosition;
            
            viewer.viewerNodes.$viewer.on(evName.move, onTouchMove);
            viewer.viewerNodes.$viewer.on(evName.end, onTouchEnd);
        }
        function onTouchMove(ev) {
            // measure movement in x
            ev = normalizeEvent(ev);
            
            // user needs to swipe at least 300 pixels or half way across the screen
            var threshold = Math.min(100, initScroll.offsetWidth / 2),
                direction;
            
            // check for direction and prevent scrolling only if this is a nav gesture
            if (initScroll.atRight && ev.clientX < initPosition.clientX) {
                direction = 'left';
                ev.preventDefault();
            } else if (initScroll.atLeft && ev.clientX > initPosition.clientX) {
                direction = 'right';
                ev.preventDefault();
            }
            
            // assign a task to do at the end of the gesture
            if (Math.abs(ev.clientX - initPosition.clientX) > threshold) {
                switch(direction) {
                    case 'left':
                        viewer.viewerControl.changeToNextPage();
                        break;
                    case 'right':
                        viewer.viewerControl.changeToPrevPage();
                        break;
                }
                
                // clean up
                onTouchEnd();
            }
        }
        function onTouchEnd(ev) {
            // reset all variables
            initPosition = initScroll = undefined;
            pointerIds = [];
            pointerList = [];
            
            viewer.viewerNodes.$viewer.off(evName.move, onTouchMove);
            viewer.viewerNodes.$viewer.off(evName.end, onTouchEnd);
        }
        
        function attachEvents() {
            viewer.viewerNodes.$viewer.on(evName.start, onTouchStart);
        }
        function detachEvents() {
            viewer.viewerNodes.$viewer.off(evName.start, onTouchStart);
        }
        
        function init() {
            scrollDom = viewer.viewerNodes.$dom.find('.pccPageListContainerWrapper').get(0);
            attachEvents();
        }
        
        function destroy() {
            detachEvents();
        }
        
        return {
            init: init,
            destroy: destroy
        };
    }
    
    // Destroy the viewer control
    Viewer.prototype.destroy = function () {
        if (this.viewerControl) {
            this.viewerControl.destroy();
            delete this.viewerControl;
        }
        
        if (this.onDestroy) {
            this.onDestroy();
        }

        this.nodes.$dom.removeClass('pccv pcc-full-screen');
        this.nodes.$dom.removeData(DATAKEY);
        this.nodes.$dom.empty();

        // detach window resize callbacks
        _.each(this.resizeCallbacks, function(cb) {
            $(window).off('resize', cb);
        });
    };

    Viewer.prototype.search = function(str, opts) {
        var viewer = this,
            searchTask = viewer.viewerControl.search(str),
            resultCount = 0,
            selectedId,
            $event = $({}),
            currentPageNumber = viewer.viewerControl.getPageNumber(),
            fullClass = 'pcc-search-full',
            noResultsClass = 'pcc-search-empty';
        
        var resultView = {
            elem: function(type, opts){
                opts = opts || {};
                var elem = document.createElement(type || 'div');
                if (typeof opts.className === 'string') {
                    elem.className = opts.className;
                }
                if (typeof opts.text !== 'undefined') {
                    // Sanitize the text being inserted into the DOM
                    elem.appendChild( document.createTextNode(opts.text.toString()) );
                }
                return elem;
            },
            textContext: function(result) {
                var contextElem, emphasis, textBefore, textAfter;

                var contextClassName = 'pcc-col-10';
                contextElem = resultView.elem('div', { className: contextClassName });

                // make the selected text interesting
                emphasis = resultView.elem('span', { className: 'match', text: result.getText() });
                emphasis.style.color = result.getHighlightColor();

                // get the text before and after the search hit
                textBefore = result.getContext().substr(0, result.getStartIndexInContext());
                textAfter = result.getContext().substr(result.getText().length + result.getStartIndexInContext());

                // append the text nodes
                // avoid adding blank text nodes
                if (textBefore) {
                    contextElem.appendChild( document.createTextNode('...' + textBefore) );
                }
                contextElem.appendChild( emphasis );
                if (textAfter) {
                    contextElem.appendChild( document.createTextNode(textAfter + '...') );
                }

                return contextElem;
            },
            pageNumber: function(number){
                return resultView.elem('div', { className: 'pcc-col-2 pcc-center', text: number });
            },
            searchResult: function(result){
                var searchResult, searchResultPageNumber, searchResultContext;

                searchResult = resultView.elem('div', { className: 'pcc-row pcc-clearfix' });
                searchResult.setAttribute('data-pcc-search-result-id', result.getId());

                searchResultPageNumber = resultView.pageNumber( result.getPageNumber() );

                searchResultContext = resultView.textContext(result);

                searchResult.appendChild(searchResultPageNumber);
                searchResult.appendChild(searchResultContext);

                $(searchResult).on('click', function () {
                    selectedId = result.getId();
                    
                    viewer.viewerControl.setSelectedSearchResult(result);
                    viewer.viewerControl.setPageNumber( result.getPageNumber() );
                    
                    $(searchResult).addClass('pcc-selected');
                    
                    $event.trigger('selectionchanged', { id: selectedId });
                    
                    $event.one('selectionchanged', function(){
                        $(searchResult).removeClass('pcc-selected');
                    });
                    
                    viewer.searchManager.hideList();
                });

                return searchResult;
            }
        };
        
        function handlePartialResults(ev) {
            if (ev.partialSearchResults && ev.partialSearchResults.length) {
                var fragment = document.createDocumentFragment();
                
                _.forEach(ev.partialSearchResults, function(result){
                    fragment.appendChild( resultView.searchResult(result) );
                    
                    if (selectedId === undefined && result.getPageNumber() >= currentPageNumber) {
                        $(fragment).children().last().click();
                        selectedId = result.getId();
                    }
                });
                
                resultCount += ev.partialSearchResults.length;
                
                viewer.viewerNodes.$searchResultList.append(fragment);
                
                if (selectedId !== undefined) {
                    updateSelectedResult(selectedId);
                }
                
                updateProgress(ev.partialSearchResults[0].getPageNumber());
            }
        }
        
        function handleSearchCompleted(ev) {
            hideProgress();

            if (ev.completedSearchResults.length) {
                if (selectedId === undefined) {
                    // select the first result or update the selection
                    viewer.viewerNodes.$searchResultList.children().first().click();
                } else {
                    // update the selection to reflect all results
                    updateSelectedResult(selectedId);
                }
            }
            else{
                //No results
                viewer.viewerNodes.$searchCurrentResult.html(viewer.language.searchResultsNone);
                viewer.viewerNodes.$searchToolbar.addClass(noResultsClass);
            }
        }
        
        function handleSearchCleared(ev) {
            hideProgress();
            
            resultCount = 0;
            
            viewer.viewerNodes.$searchResultList.empty();
            viewer.viewerNodes.$searchBox.val('');
            viewer.viewerNodes.$searchToolbar.removeClass(fullClass);
            viewer.viewerNodes.$searchToolbar.removeClass(noResultsClass);
            viewer.searchManager.hideList();
            searchTask.cancel();
            detachEvents();
        }
        
        function updateSelectedResult(id){
            if (!viewer.viewerNodes.$searchToolbar.hasClass(fullClass)) {
                viewer.viewerNodes.$searchToolbar.addClass(fullClass);
            }
            if(viewer.viewerNodes.$searchToolbar.hasClass(noResultsClass)){
                viewer.viewerNodes.$searchToolbar.removeClass(noResultsClass);
            }

            var disable = false;
            
            if (id === undefined) {
                viewer.viewerNodes.$searchCurrentResult.html(viewer.language.imageStampLoading);
                disable = true;
            } else {
                viewer.viewerNodes.$searchCurrentResult.html((id + 1) + '/' + resultCount);
            }
            
            if (id === 0 || disable) {
                viewer.viewerNodes.$searchNavPrev.attr('disabled', 'disabled');
            } else {
                viewer.viewerNodes.$searchNavPrev.removeAttr('disabled');
            }

            if (id + 1 === resultCount || disable) {
                viewer.viewerNodes.$searchNavNext.attr('disabled', 'disabled');
            } else {
                viewer.viewerNodes.$searchNavNext.removeAttr('disabled');
            }
        }
        
        function showProgress(){
            viewer.viewerNodes.$searchProgress.show();
        }
        function hideProgress(){
            viewer.viewerNodes.$searchProgress.hide();
        }
        function updateProgress(pageNum){
            viewer.viewerNodes.$searchProgress
                .find('.pcc-search-progress-thumb')
                .width(pageNum / viewer.viewerControl.getPageCount() * 100 + '%');
        }
        
        function goToPrevResult() {
            viewer.viewerNodes.$searchResultList.find('[data-pcc-search-result-id=' + selectedId + ']').prev().click();
        }
        function goToNextResult() {
            viewer.viewerNodes.$searchResultList.find('[data-pcc-search-result-id=' + selectedId + ']').next().click();
        }
        
        function attachEvents() {
            $event.on('selectionchanged', function(ev, params) {
                updateSelectedResult(params.id);
            });
            
            viewer.viewerNodes.$searchNavPrev.on('click', goToPrevResult);
            viewer.viewerNodes.$searchNavNext.on('click', goToNextResult);

            viewer.viewerControl.on(PCCViewer.EventType.SearchCleared, handleSearchCleared);
        }
        
        function detachEvents() {
            $event.off();
            viewer.viewerControl.off(PCCViewer.EventType.SearchCleared, handleSearchCleared);
            viewer.viewerNodes.$searchNavPrev.off('click', goToPrevResult);
            viewer.viewerNodes.$searchNavNext.off('click', goToNextResult);
        }
        
        // reset any previous search
        viewer.viewerNodes.$searchResultList.empty();
        detachEvents();
        
        // show the entire overlay
        viewer.searchManager.show();
        updateSelectedResult();
        showProgress();
        updateProgress(0);
        
        searchTask.on(PCCViewer.EventType.PartialSearchResultsAvailable, handlePartialResults);
        searchTask.on(PCCViewer.EventType.SearchCompleted, handleSearchCompleted);
        
        attachEvents();
    };
    
    // Expose the Viewer through a jQuery plugin
    $.fn.pccBookreader = function (options) {
        if (typeof options === 'undefined') {
            // If we are not given an options argument, return any existing viewer object associated with the
            // selected element.
            return this.data(DATAKEY);
        }
        else {
            // set the language data
            PCCViewer.Language.initializeData(options.language);

            // Create a new viewer
            return new Viewer(this, options);
        }
    };
})(jQuery);
