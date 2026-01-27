document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const config = {
        apiEndpoint: 'https://s5uvefaoe8.execute-api.us-east-1.amazonaws.com/prod/recommendations',
        booksPerPage: 30,
        maxVisiblePages: 10, // Show more pages
        debounceDelay: 500,
        // Higher quality image parameters
        imageQuality: {
            width: 600,
            height: 800,
            quality: 'high'
        }
    };

    // State Management
    const state = {
        currentTheme: localStorage.getItem('theme') || 'light',
        allBooks: [],
        filteredBooks: [],
        currentGenre: 'all',
        currentSort: 'relevance',
        currentPageFilter: 'any',
        searchQuery: '',
        currentPage: 1,
        totalBooks: 0,
        totalPages: 1,
        isLoading: false,
        isInitialLoad: true,
        searchTimeout: null,
        wishlist: JSON.parse(localStorage.getItem('wishlist') || '[]'),
        loadedPages: new Set([1]),
        pageCache: new Map(),
        lastSearchId: 0
    };

    // DOM Elements
    const elements = {
        bookGrid: document.getElementById('bookGrid'),
        searchInput: document.getElementById('searchInput'),
        searchBtn: document.getElementById('searchBtn'),
        sortSelect: document.getElementById('sortSelect'),
        pageCountFilter: document.getElementById('pageCountFilter'),
        genreButtons: document.getElementById('genreButtons'),
        themeToggle: document.getElementById('themeToggle'),
        themeIcon: document.getElementById('themeIcon'),
        paginationContainer: document.getElementById('paginationContainer'),
        toastContainer: document.getElementById('toastContainer'),
        booksCount: document.getElementById('booksCount')
    };

    // Initialize Application
    initializeApp();

    function initializeApp() {
        initTheme();
        setupEventListeners();
        loadBooks();
    }

    // Theme Management - FIXED
    function initTheme() {
        document.documentElement.setAttribute('data-theme', state.currentTheme);
        updateThemeIcon();
    }

    function updateThemeIcon() {
        if (elements.themeIcon) {
            elements.themeIcon.className = state.currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    function toggleTheme() {
        state.currentTheme = state.currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', state.currentTheme);
        updateThemeIcon();
        localStorage.setItem('theme', state.currentTheme);
        showToast(state.currentTheme === 'dark' ? 'Dark mode activated' : 'Light mode activated', 'info');
    }

    // Event Listeners
    function setupEventListeners() {
        // Theme toggle - FIXED
        if (elements.themeToggle) {
            elements.themeToggle.addEventListener('click', toggleTheme);
        }

        // Search with debouncing
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', debounceSearch);
        }
        
        if (elements.searchBtn) {
            elements.searchBtn.addEventListener('click', executeSearch);
        }
        
        if (elements.searchInput) {
            elements.searchInput.addEventListener('keyup', (e) => e.key === 'Enter' && executeSearch());
        }

        // Filters
        if (elements.sortSelect) {
            elements.sortSelect.addEventListener('change', handleSortChange);
        }
        
        if (elements.pageCountFilter) {
            elements.pageCountFilter.addEventListener('change', handlePageFilterChange);
        }

        // Genre buttons
        if (elements.genreButtons) {
            elements.genreButtons.addEventListener('click', handleGenreClick);
        }

        // Infinite scroll (optional enhancement)
        window.addEventListener('scroll', debounce(handleScroll, 200));
    }

    // Search Functions
    function debounceSearch() {
        clearTimeout(state.searchTimeout);
        state.searchTimeout = setTimeout(executeSearch, config.debounceDelay);
    }

    function executeSearch() {
        const query = elements.searchInput ? elements.searchInput.value.trim() : '';
        if (query !== state.searchQuery) {
            state.searchQuery = query;
            state.currentPage = 1;
            state.loadedPages.clear();
            state.loadedPages.add(1);
            state.pageCache.clear();
            state.lastSearchId++;
            loadBooks();
        }
    }

    // Filter Handlers
    function handleSortChange() {
        state.currentSort = elements.sortSelect ? elements.sortSelect.value : 'relevance';
        applyFilters();
    }

    function handlePageFilterChange() {
        state.currentPageFilter = elements.pageCountFilter ? elements.pageCountFilter.value : 'any';
        applyFilters();
    }

    function handleGenreClick(event) {
        const genreBtn = event.target.closest('.genre-btn');
        if (!genreBtn) return;

        // Update active state
        document.querySelectorAll('.genre-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        
        genreBtn.classList.add('active');
        genreBtn.setAttribute('aria-pressed', 'true');
        
        // Update state and load books
        state.currentGenre = genreBtn.dataset.genre || 'all';
        state.currentPage = 1;
        state.loadedPages.clear();
        state.loadedPages.add(1);
        state.pageCache.clear();
        loadBooks();
    }

    // API Integration
    async function loadBooks() {
        if (state.isLoading) return;
        
        state.isLoading = true;
        showLoadingState();

        try {
            // Check cache first
            const cacheKey = getCacheKey();
            if (state.pageCache.has(cacheKey)) {
                const cached = state.pageCache.get(cacheKey);
                processBooksData(cached);
                return;
            }

            const params = new URLSearchParams();
            if (state.searchQuery) params.append('query', state.searchQuery);
            if (state.currentGenre !== 'all') params.append('genre', state.currentGenre);
            params.append('page', state.currentPage - 1);
            params.append('perPage', config.booksPerPage);

            const response = await fetch(`${config.apiEndpoint}?${params.toString()}`, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch books: ${response.status}`);
            }

            const data = await response.json();
            state.pageCache.set(cacheKey, data);
            processBooksData(data);
            
        } catch (error) {
            console.error('Error loading books:', error);
            showErrorState('The collection is currently unavailable. Please try again later.');
            showToast('Connection to the bibliotheca failed', 'error');
        } finally {
            state.isLoading = false;
            state.isInitialLoad = false;
        }
    }

    function getCacheKey() {
        return `${state.searchQuery}-${state.currentGenre}-${state.currentPage}-${state.currentSort}-${state.currentPageFilter}`;
    }

    function processBooksData(data) {
        if (!data.books || data.books.length === 0) {
            if (state.isInitialLoad) {
                showEmptyState('The collection appears to be empty. Try a different search or adjust your filters.');
            } else {
                showEmptyState('No volumes match your criteria. Consider broadening your search.');
            }
            elements.paginationContainer.innerHTML = '';
            updateBooksCount(0);
            return;
        }

        state.allBooks = processBooks(data.books);
        state.totalBooks = data.totalItems || data.books.length;
        state.totalPages = Math.ceil(state.totalBooks / config.booksPerPage);
        
        state.loadedPages.add(state.currentPage);
        applyFilters();
        updatePagination();
        updateBooksCount(state.totalBooks);
        
        showToast(`Found ${state.totalBooks} volumes in the collection`, 'success');
    }

    // Data Processing with HIGH QUALITY IMAGES
    function processBooks(books) {
        return books.map(book => {
            // Generate high-quality image URLs
            const imageUrls = generateHighQualityImages(book);
            
            // Generate purchase links with fallbacks
            const purchaseLinks = generatePurchaseLinks(book);
            
            return {
                id: book.id || generateId(),
                title: book.title || 'Untitled Volume',
                author: book.author || 'Author Unknown',
                description: book.description || 'No synopsis available for this volume.',
                image: imageUrls.highQuality,
                thumbnail: imageUrls.thumbnail,
                genre: book.genre || 'general',
                categories: book.categories || [book.genre || 'general'],
                rating: parseFloat(book.rating) || 0,
                ratingCount: book.ratingCount || 0,
                pageCount: parseInt(book.pageCount) || 0,
                publishedDate: book.publishedDate || '',
                publisher: book.publisher || '',
                language: book.language || 'en',
                price: formatPrice(book.price),
                currency: book.currency || 'USD',
                amount: parseFloat(book.amount) || 0,
                purchaseLinks: purchaseLinks,
                primaryPurchaseLink: purchaseLinks.amazonAffiliate || purchaseLinks.amazon || purchaseLinks.google || purchaseLinks.generic,
                isEbook: book.isEbook || false,
                availability: book.availability || 'available',
                previewLink: book.previewLink || '',
                infoLink: book.infoLink || '',
                isbn: book.isbn || {},
                popularityScore: parseFloat(book.popularityScore) || 0,
                readingAge: book.readingAge || 'general',
                keywords: book.keywords || [],
                isWishlisted: state.wishlist.includes(book.id || ''),
                edition: book.edition || 'First Edition'
            };
        });
    }

    function generateHighQualityImages(book) {
        let baseImage = book.image || book.thumbnail || '';
        
        // If no image provided, generate vintage placeholder
        if (!baseImage) {
            return {
                highQuality: generateVintagePlaceholder(book.title, 'high'),
                thumbnail: generateVintagePlaceholder(book.title, 'thumb')
            };
        }
        
        // Try to get higher quality versions for Google Books API
        if (baseImage.includes('googlebooks') || baseImage.includes('books.google')) {
            // Replace thumbnail with medium or large version
            baseImage = baseImage.replace('zoom=1', 'zoom=2');
            baseImage = baseImage.replace('&edge=curl', '');
            baseImage = baseImage.replace('thumbnail', 'thumbnail');
            
            // Try to get larger version
            const largeImage = baseImage.replace('&zoom=1', '&zoom=3')
                                       .replace('thumbnail', 'thumbnail')
                                       .replace('_SX50_', '_SX600_')
                                       .replace('_SY75_', '_SY800_');
            
            return {
                highQuality: largeImage,
                thumbnail: baseImage
            };
        }
        
        // For other APIs, try to enhance the image
        return {
            highQuality: baseImage.replace('_SX50_', '_SX600_')
                                 .replace('_SY75_', '_SY800_')
                                 .replace('w100-h100', 'w600-h800')
                                 .replace('/100/', '/600/'),
            thumbnail: baseImage
        };
    }

    function generateVintagePlaceholder(title, size = 'high') {
        const width = size === 'high' ? 600 : 300;
        const height = size === 'high' ? 800 : 400;
        
        const colors = ['3a2718', '4a2c2a', '5a716a', '8b1e1e', '2a2420'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const initials = title ? title.charAt(0).toUpperCase() : 'B';
        const authorInitial = title && title.includes(' ') ? 
            title.split(' ')[1].charAt(0).toUpperCase() : 'L';
        
        // Vintage-style placeholder
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 300 400'%3E%3Crect width='300' height='400' fill='%23${color}'/%3E%3Crect x='10' y='10' width='280' height='380' fill='none' stroke='%23c9a87a' stroke-width='2'/%3E%3Cpath d='M20 20 L280 20 L280 60 L20 60 Z' fill='%23c9a87a' fill-opacity='0.3'/%3E%3Ctext x='150' y='200' font-family='Libre Baskerville' font-size='60' fill='%23c9a87a' text-anchor='middle' dominant-baseline='middle' letter-spacing='2'%3E${initials}%3C/text%3E%3Ctext x='150' y='250' font-family='Crimson Text' font-size='24' fill='%23f5f1e8' text-anchor='middle' font-style='italic'%3E${encodeURIComponent(title || 'Classic Volume')}%3C/text%3E%3Ctext x='150' y='350' font-family='Libre Baskerville' font-size='18' fill='%23c9a87a' text-anchor='middle'%3EThe Bibliotheca Collection%3C/text%3E%3C/svg%3E`;
    }

    function generatePurchaseLinks(book) {
        const encodedTitle = encodeURIComponent(book.title || '');
        const encodedAuthor = encodeURIComponent(book.author || '');
        const searchQuery = encodeURIComponent(`${book.title} ${book.author}`.trim());
        
        return {
            amazon: `https://www.amazon.com/s?k=${searchQuery}`,
            amazonAffiliate: `https://www.amazon.com/s?k=${searchQuery}&tag=bibliotheca-20`,
            google: book.infoLink || `https://books.google.com/books/about/${encodedTitle}.html`,
            barnesNoble: `https://www.barnesandnoble.com/s/${searchQuery}`,
            abeBooks: `https://www.abebooks.com/servlet/SearchResults?kn=${searchQuery}`,
            goodreads: `https://www.goodreads.com/search?q=${searchQuery}`,
            openLibrary: book.id ? `https://openlibrary.org/search?q=${book.id}` : '',
            ebook: book.isEbook ? (book.infoLink || `https://books.google.com/books?id=${book.id}`) : '',
            generic: `https://www.google.com/search?q=${searchQuery}+first+edition`
        };
    }

    function generateId() {
        return 'vol_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    function formatPrice(price) {
        if (!price || price === 'Not available' || price === 'Free') return 'Price upon request';
        if (typeof price === 'string') {
            // Format currency nicely
            if (price.includes('$')) return price;
            if (price.includes('£')) return price;
            if (price.includes('€')) return price;
            return `$${parseFloat(price.replace(/[^0-9.-]+/g, '')).toFixed(2)}`;
        }
        return `$${parseFloat(price).toFixed(2)}`;
    }

    // Filtering and Sorting
    function applyFilters() {
        // Apply page count filter
        let filtered = filterByPageCount(state.allBooks);
        
        // Apply sorting
        filtered = sortBooks(filtered, state.currentSort);
        
        state.filteredBooks = filtered;
        
        // Update display for current page
        displayBooksForCurrentPage();
        updatePagination();
    }

    function filterByPageCount(books) {
        if (state.currentPageFilter === 'any') return books;
        
        return books.filter(book => {
            if (!book.pageCount) return false;
            
            const pageCount = book.pageCount;
            
            switch(state.currentPageFilter) {
                case 'short': return pageCount < 300;
                case 'medium': return pageCount >= 300 && pageCount <= 600;
                case 'long': return pageCount > 600;
                default: return true;
            }
        });
    }

    function sortBooks(books, sortBy) {
        const sorted = [...books];
        
        switch(sortBy) {
            case 'rating':
                return sorted.sort((a, b) => b.rating - a.rating);
                
            case 'newest':
                return sorted.sort((a, b) => {
                    const dateA = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
                    const dateB = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;
                    return dateB - dateA;
                });
                
            case 'popular':
                return sorted.sort((a, b) => b.popularityScore - a.popularityScore);
                
            default: // 'relevance'
                return sorted;
        }
    }

    // Display Functions
    function displayBooksForCurrentPage() {
        const startIdx = (state.currentPage - 1) * config.booksPerPage;
        const endIdx = startIdx + config.booksPerPage;
        const booksToDisplay = state.filteredBooks.slice(startIdx, endIdx);

        if (booksToDisplay.length === 0) {
            if (state.currentPage > 1) {
                // If no books on this page, go to page 1
                changePage(1);
                return;
            }
            showEmptyState('No volumes match your refined criteria. Try adjusting your search parameters.');
            return;
        }

        const booksHTML = booksToDisplay.map((book, index) => createBookCard(book, index)).join('');
        
        if (elements.bookGrid) {
            // Add books with staggered animation
            elements.bookGrid.innerHTML = booksHTML;
            
            // Trigger animations
            setTimeout(() => {
                document.querySelectorAll('.book-card').forEach((card, i) => {
                    card.style.animationDelay = `${i * 0.1}s`;
                });
            }, 100);
        }
    }

    function createBookCard(book, index) {
        const primaryGenre = book.categories?.[0] || book.genre || 'Classic';
        const isWishlisted = state.wishlist.includes(book.id);
        const ratingText = book.rating > 0 ? `${book.rating.toFixed(1)}/5.0` : 'Unrated';
        
        return `
            <div class="book-card" role="article" aria-label="${book.title} by ${book.author}" 
                 style="animation-delay: ${index * 0.1}s">
                <div class="book-cover-container">
                    <img src="${book.thumbnail}" 
                         alt="First edition cover of ${book.title}"
                         class="book-cover"
                         loading="lazy"
                         width="300"
                         height="420"
                         onerror="this.src='${book.image}'"
                         data-src="${book.image}">
                    <span class="book-badge">${primaryGenre}</span>
                </div>
                
                <div class="book-info">
                    <h3 class="book-title">${book.title}</h3>
                    <p class="book-author">${book.author}</p>
                    
                    <div class="book-meta">
                        <span class="book-rating" title="${ratingText}">
                            ${generateStarRating(book.rating)}
                            <span class="rating-text">${ratingText}</span>
                        </span>
                        <span class="book-pages" title="${book.pageCount} pages">
                            <i class="fas fa-book-open"></i>
                            ${book.pageCount ? `${book.pageCount}p` : '—'}
                        </span>
                    </div>
                    
                    <p class="book-description">
                        ${book.description.substring(0, 180)}${book.description.length > 180 ? '...' : ''}
                    </p>
                    
                    <div class="book-footer">
                        <span class="book-price">
                            ${book.price}
                        </span>
                        <div class="book-actions">
                            <a href="${book.primaryPurchaseLink}" 
                               class="btn-buy"
                               target="_blank"
                               rel="noopener noreferrer nofollow"
                               aria-label="Acquire ${book.title}">
                                <i class="fas fa-shopping-cart"></i>
                                <span>Acquire</span>
                            </a>
                            <button class="btn-wishlist ${isWishlisted ? 'wishlisted' : ''}" 
                                    onclick="toggleWishlist('${book.id}', this)"
                                    aria-label="${isWishlisted ? 'Remove from collection' : 'Add to collection'}"
                                    title="${isWishlisted ? 'In your collection' : 'Add to collection'}">
                                <i class="${isWishlisted ? 'fas' : 'far'} fa-heart"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function generateStarRating(rating) {
        if (!rating || rating === 0) {
            return '<span class="no-rating">Not rated</span>';
        }
        
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        
        let stars = '';
        
        // Full stars
        for (let i = 0; i < fullStars; i++) {
            stars += '<i class="fas fa-star" aria-hidden="true"></i>';
        }
        
        // Half star
        if (hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt" aria-hidden="true"></i>';
        }
        
        // Empty stars
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        for (let i = 0; i < emptyStars; i++) {
            stars += '<i class="far fa-star" aria-hidden="true"></i>';
        }
        
        return stars;
    }

    // Pagination Functions - IMPROVED
    function updatePagination() {
        if (!elements.paginationContainer) return;
        
        const totalPages = Math.ceil(state.filteredBooks.length / config.booksPerPage);
        state.totalPages = Math.max(1, totalPages);
        
        if (state.totalPages <= 1) {
            elements.paginationContainer.innerHTML = '';
            return;
        }
        
        const paginationHTML = createPaginationHTML(state.totalPages);
        elements.paginationContainer.innerHTML = paginationHTML;
        
        // Attach event listeners to new pagination buttons
        attachPaginationListeners();
    }

    function createPaginationHTML(totalPages) {
        let paginationHTML = `
            <nav class="pagination" role="navigation" aria-label="Volume navigation">
                <button class="pagination-btn ${state.currentPage === 1 ? 'disabled' : ''}"
                        ${state.currentPage === 1 ? 'disabled' : ''}
                        data-page="1"
                        aria-label="First volume">
                    <i class="fas fa-step-backward"></i>
                </button>
                <button class="pagination-btn ${state.currentPage === 1 ? 'disabled' : ''}"
                        ${state.currentPage === 1 ? 'disabled' : ''}
                        data-page="${state.currentPage - 1}"
                        aria-label="Previous volume">
                    <i class="fas fa-chevron-left"></i>
                    <span>Previous</span>
                </button>
                
                <div class="page-numbers">`;
        
        // Show first page
        paginationHTML += `
            <button class="pagination-btn ${state.currentPage === 1 ? 'active' : ''}"
                    data-page="1"
                    aria-label="Volume 1"
                    aria-current="${state.currentPage === 1 ? 'page' : 'false'}">
                1
            </button>`;
        
        // Calculate page range
        let startPage = Math.max(2, state.currentPage - Math.floor(config.maxVisiblePages / 2));
        let endPage = Math.min(totalPages - 1, startPage + config.maxVisiblePages - 1);
        
        // Adjust if range is too small
        if (endPage - startPage < config.maxVisiblePages - 1) {
            startPage = Math.max(2, endPage - config.maxVisiblePages + 1);
        }
        
        // Show ellipsis if needed
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-dots" aria-hidden="true">...</span>`;
        }
        
        // Show middle pages
        for (let i = startPage; i <= endPage; i++) {
            if (i > 1 && i < totalPages) {
                paginationHTML += `
                    <button class="pagination-btn ${state.currentPage === i ? 'active' : ''}"
                            data-page="${i}"
                            aria-label="Volume ${i}"
                            aria-current="${state.currentPage === i ? 'page' : 'false'}">
                        ${i}
                    </button>`;
            }
        }
        
        // Show ellipsis if needed
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="pagination-dots" aria-hidden="true">...</span>`;
        }
        
        // Show last page if there is more than one page
        if (totalPages > 1) {
            paginationHTML += `
                <button class="pagination-btn ${state.currentPage === totalPages ? 'active' : ''}"
                        data-page="${totalPages}"
                        aria-label="Volume ${totalPages}">
                    ${totalPages}
                </button>`;
        }
        
        paginationHTML += `
                </div>
                
                <button class="pagination-btn ${state.currentPage === totalPages ? 'disabled' : ''}"
                        ${state.currentPage === totalPages ? 'disabled' : ''}
                        data-page="${state.currentPage + 1}"
                        aria-label="Next volume">
                    <span>Next</span>
                    <i class="fas fa-chevron-right"></i>
                </button>
                <button class="pagination-btn ${state.currentPage === totalPages ? 'disabled' : ''}"
                        ${state.currentPage === totalPages ? 'disabled' : ''}
                        data-page="${totalPages}"
                        aria-label="Last volume">
                    <i class="fas fa-step-forward"></i>
                </button>
            </nav>`;
        
        return paginationHTML;
    }

    function attachPaginationListeners() {
        if (!elements.paginationContainer) return;
        
        const paginationBtns = elements.paginationContainer.querySelectorAll('.pagination-btn:not(.disabled)');
        
        paginationBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(btn.dataset.page);
                if (!isNaN(page)) {
                    changePage(page);
                }
            });
        });
    }

    function changePage(page) {
        if (page < 1 || page > state.totalPages) return;
        
        // If we already have this page loaded, just display it
        if (state.loadedPages.has(page)) {
            state.currentPage = page;
            displayBooksForCurrentPage();
            updatePagination();
            
            // Smooth scroll to top
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            
            showToast(`Viewing volume ${page} of ${state.totalPages}`, 'info');
            return;
        }
        
        // Otherwise, load the page
        state.currentPage = page;
        loadBooks();
        
        // Smooth scroll to top
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        
        showToast(`Loading volume ${page}...`, 'info');
    }

    // UI States
    function showLoadingState() {
        if (!elements.bookGrid) return;
        
        elements.bookGrid.innerHTML = `
            <div class="loading-container" aria-live="polite" aria-busy="true">
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p class="loading-text">${state.isInitialLoad ? 'Curating your literary collection...' : 'Loading volumes...'}</p>
                </div>
            </div>
        `;
        
        if (elements.paginationContainer) {
            elements.paginationContainer.innerHTML = '';
        }
        
        updateBooksCount('Loading...');
    }

    function showEmptyState(message) {
        if (!elements.bookGrid) return;
        
        elements.bookGrid.innerHTML = `
            <div class="empty-state" aria-live="polite">
                <div class="empty-icon">
                    <i class="fas fa-book-dead"></i>
                </div>
                <h3 class="empty-title">Collection Empty</h3>
                <p class="empty-description">${message}</p>
                <button class="btn-buy" onclick="resetFilters()">
                    <i class="fas fa-redo"></i>
                    <span>Reset Curatorial Filters</span>
                </button>
            </div>
        `;
        
        if (elements.paginationContainer) {
            elements.paginationContainer.innerHTML = '';
        }
        
        updateBooksCount(0);
    }

    function showErrorState(message) {
        if (!elements.bookGrid) return;
        
        elements.bookGrid.innerHTML = `
            <div class="error-state" aria-live="assertive">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3 class="error-title">Archival System Error</h3>
                <p class="error-description">${message}</p>
                <button class="btn-buy" onclick="loadBooks()">
                    <i class="fas fa-sync-alt"></i>
                    <span>Reconnect to Bibliotheca</span>
                </button>
            </div>
        `;
        
        if (elements.paginationContainer) {
            elements.paginationContainer.innerHTML = '';
        }
        
        updateBooksCount('Error');
    }

    function updateBooksCount(count) {
        if (!elements.booksCount) return;
        
        if (count === 0) {
            elements.booksCount.textContent = 'The collection appears to be empty';
        } else if (typeof count === 'number') {
            elements.booksCount.textContent = `Curated Collection: ${count} volumes found`;
        } else {
            elements.booksCount.textContent = count;
        }
    }

    // Toast System
    function showToast(message, type = 'info') {
        if (!elements.toastContainer) {
            elements.toastContainer = document.createElement('div');
            elements.toastContainer.id = 'toastContainer';
            elements.toastContainer.className = 'toast-container';
            document.body.appendChild(elements.toastContainer);
        }
        
        const toastId = `toast-${Date.now()}`;
        const toastElement = document.createElement('div');
        
        toastElement.id = toastId;
        toastElement.className = `toast ${type}`;
        toastElement.setAttribute('role', 'alert');
        toastElement.innerHTML = `
            <i class="fas fa-${getToastIcon(type)}"></i>
            <span>${message}</span>
            <button onclick="removeToast('${toastId}')" aria-label="Dismiss notification">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        elements.toastContainer.appendChild(toastElement);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            removeToast(toastId);
        }, 5000);
    }

    function getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Wishlist Functions
    function toggleWishlist(bookId, buttonElement) {
        const book = state.allBooks.find(b => b.id === bookId);
        if (!book) return;
        
        const index = state.wishlist.indexOf(bookId);
        
        if (index === -1) {
            // Add to wishlist
            state.wishlist.push(bookId);
            showToast(`"${book.title}" added to your collection`, 'success');
            
            if (buttonElement) {
                buttonElement.classList.add('wishlisted');
                buttonElement.querySelector('i').className = 'fas fa-heart';
                buttonElement.setAttribute('aria-label', 'Remove from collection');
            }
        } else {
            // Remove from wishlist
            state.wishlist.splice(index, 1);
            showToast(`"${book.title}" removed from collection`, 'info');
            
            if (buttonElement) {
                buttonElement.classList.remove('wishlisted');
                buttonElement.querySelector('i').className = 'far fa-heart';
                buttonElement.setAttribute('aria-label', 'Add to collection');
            }
        }
        
        // Update book state
        const bookIndex = state.allBooks.findIndex(b => b.id === bookId);
        if (bookIndex !== -1) {
            state.allBooks[bookIndex].isWishlisted = index === -1;
        }
        
        // Save to localStorage
        localStorage.setItem('wishlist', JSON.stringify(state.wishlist));
    }

    // Utility Functions
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function handleScroll() {
        // Optional: Implement infinite scroll here if desired
        // For now, we're using pagination
    }

    // Image lazy loading enhancement
    function enhanceImageLoading() {
        const images = document.querySelectorAll('img.book-cover[data-src]');
        images.forEach(img => {
            if (img.getBoundingClientRect().top < window.innerHeight + 100) {
                const highResSrc = img.getAttribute('data-src');
                if (highResSrc && highResSrc !== img.src) {
                    const highResImg = new Image();
                    highResImg.src = highResSrc;
                    highResImg.onload = () => {
                        img.src = highResSrc;
                        img.style.opacity = '1';
                    };
                }
            }
        });
    }

    // Initialize image enhancement
    document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('scroll', debounce(enhanceImageLoading, 200));
        enhanceImageLoading();
    });

    // Global functions
    window.removeToast = function(toastId) {
        const toast = document.getElementById(toastId);
        if (toast && toast.parentElement) {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }
    };

    window.toggleWishlist = toggleWishlist;

    window.resetFilters = function() {
        state.currentGenre = 'all';
        state.currentSort = 'relevance';
        state.currentPageFilter = 'any';
        state.currentPage = 1;
        state.searchQuery = '';
        state.loadedPages.clear();
        state.loadedPages.add(1);
        state.pageCache.clear();
        
        // Reset UI
        if (elements.searchInput) elements.searchInput.value = '';
        if (elements.sortSelect) elements.sortSelect.value = 'relevance';
        if (elements.pageCountFilter) elements.pageCountFilter.value = 'any';
        
        document.querySelectorAll('.genre-btn').forEach(btn => {
            const isAll = btn.dataset.genre === 'all';
            btn.classList.toggle('active', isAll);
            btn.setAttribute('aria-pressed', isAll.toString());
        });
        
        loadBooks();
        showToast('Curatorial filters reset', 'info');
    };

    // Handle browser back/forward
    window.addEventListener('popstate', function() {
        const params = new URLSearchParams(window.location.search);
        
        const genre = params.get('genre') || 'all';
        const sort = params.get('sort') || 'relevance';
        const pages = params.get('pages') || 'any';
        const page = parseInt(params.get('page') || '1');
        const query = params.get('q') || '';
        
        // Update state
        state.currentGenre = genre;
        state.currentSort = sort;
        state.currentPageFilter = pages;
        state.currentPage = page;
        state.searchQuery = query;
        state.loadedPages.clear();
        state.loadedPages.add(page);
        
        // Update UI
        if (elements.searchInput) elements.searchInput.value = query;
        if (elements.sortSelect) elements.sortSelect.value = sort;
        if (elements.pageCountFilter) elements.pageCountFilter.value = pages;
        
        document.querySelectorAll('.genre-btn').forEach(btn => {
            const isActive = btn.dataset.genre === genre;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive.toString());
        });
        
        loadBooks();
    });

    // Initialize URL state and update URL on changes
    function updateURL() {
        const params = new URLSearchParams();
        if (state.currentGenre !== 'all') params.set('genre', state.currentGenre);
        if (state.currentSort !== 'relevance') params.set('sort', state.currentSort);
        if (state.currentPageFilter !== 'any') params.set('pages', state.currentPageFilter);
        if (state.currentPage !== 1) params.set('page', state.currentPage);
        if (state.searchQuery) params.set('q', state.searchQuery);
        
        const newURL = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
        window.history.pushState({}, '', newURL);
    }

    // Update URL whenever state changes
    const originalLoadBooks = loadBooks;
    loadBooks = async function() {
        await originalLoadBooks.apply(this, arguments);
        updateURL();
    };

    const originalApplyFilters = applyFilters;
    applyFilters = function() {
        originalApplyFilters.apply(this, arguments);
        updateURL();
    };

    // Initialize from URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('genre') || urlParams.has('sort') || urlParams.has('pages') || urlParams.has('q')) {
        const genre = urlParams.get('genre') || 'all';
        const sort = urlParams.get('sort') || 'relevance';
        const pages = urlParams.get('pages') || 'any';
        const page = parseInt(urlParams.get('page') || '1');
        const query = urlParams.get('q') || '';
        
        // Update state
        state.currentGenre = genre;
        state.currentSort = sort;
        state.currentPageFilter = pages;
        state.currentPage = page;
        state.searchQuery = query;
        
        // Update UI
        if (elements.searchInput) elements.searchInput.value = query;
        if (elements.sortSelect) elements.sortSelect.value = sort;
        if (elements.pageCountFilter) elements.pageCountFilter.value = pages;
        
        document.querySelectorAll('.genre-btn').forEach(btn => {
            const isActive = btn.dataset.genre === genre;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive.toString());
        });
    }
});
