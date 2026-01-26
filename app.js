document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const config = {
        apiEndpoint: 'https://s5uvefaoe8.execute-api.us-east-1.amazonaws.com/prod/recommendations',
        booksPerPage: 12,
        maxVisiblePages: 5,
        debounceDelay: 300
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
        searchTimeout: null,
        wishlist: JSON.parse(localStorage.getItem('wishlist') || '[]')
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
        toastContainer: document.getElementById('toastContainer')
    };

    // Initialize Application
    initializeApp();

    function initializeApp() {
        initTheme();
        setupEventListeners();
        loadBooks();
    }

    // Theme Management
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
        showToast('Theme updated!', 'success');
    }

    // Event Listeners
    function setupEventListeners() {
        // Theme toggle
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
    }

    // Search Functions
    function debounceSearch() {
        clearTimeout(state.searchTimeout);
        state.searchTimeout = setTimeout(executeSearch, config.debounceDelay);
    }

    function executeSearch() {
        state.searchQuery = elements.searchInput ? elements.searchInput.value.trim() : '';
        state.currentPage = 1;
        loadBooks();
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
        loadBooks();
    }

    // API Integration
    async function loadBooks() {
        if (state.isLoading) return;
        
        state.isLoading = true;
        showLoadingState();

        try {
            const params = new URLSearchParams();
            if (state.searchQuery) params.append('query', state.searchQuery);
            if (state.currentGenre !== 'all') params.append('genre', state.currentGenre);
            params.append('page', state.currentPage - 1); // API expects 0-based index
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
            
            if (!data.books || data.books.length === 0) {
                showEmptyState('No books found. Try adjusting your search or filters.');
                elements.paginationContainer.innerHTML = '';
                return;
            }

            state.allBooks = processBooks(data.books);
            state.totalBooks = data.totalItems || data.books.length;
            state.totalPages = Math.ceil(state.totalBooks / config.booksPerPage);
            
            applyFilters();
            updatePagination();
            showToast(`Found ${state.totalBooks} books`, 'success');
            
        } catch (error) {
            console.error('Error loading books:', error);
            showErrorState('Failed to load books. Please try again later.');
            showToast('Error loading books. Please try again.', 'error');
        } finally {
            state.isLoading = false;
        }
    }

    // Data Processing
    function processBooks(books) {
        return books.map(book => {
            // Generate purchase links with fallbacks
            const purchaseLinks = generatePurchaseLinks(book);
            
            return {
                id: book.id || generateId(),
                title: book.title || 'Untitled',
                author: book.author || 'Unknown Author',
                description: book.description || 'No description available.',
                image: book.image || generatePlaceholderImage(book.title),
                thumbnail: book.thumbnail || book.image || generatePlaceholderImage(book.title),
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
                primaryPurchaseLink: purchaseLinks.amazon || purchaseLinks.google || purchaseLinks.generic,
                isEbook: book.isEbook || false,
                availability: book.availability || 'available',
                previewLink: book.previewLink || '',
                infoLink: book.infoLink || '',
                isbn: book.isbn || {},
                popularityScore: parseFloat(book.popularityScore) || 0,
                readingAge: book.readingAge || 'general',
                keywords: book.keywords || [],
                isWishlisted: state.wishlist.includes(book.id || '')
            };
        });
    }

    function generatePurchaseLinks(book) {
        const encodedTitle = encodeURIComponent(book.title || '');
        const encodedAuthor = encodeURIComponent(book.author || '');
        const searchQuery = encodeURIComponent(`${book.title} ${book.author}`.trim());
        
        return {
            amazon: `https://www.amazon.com/s?k=${searchQuery}`,
            amazonAffiliate: `https://www.amazon.com/s?k=${searchQuery}&tag=bookrec-20`,
            google: book.infoLink || `https://books.google.com/books/about/${encodedTitle}.html`,
            barnesNoble: `https://www.barnesandnoble.com/s/${searchQuery}`,
            abeBooks: `https://www.abebooks.com/servlet/SearchResults?kn=${searchQuery}`,
            goodreads: `https://www.goodreads.com/search?q=${searchQuery}`,
            openLibrary: book.id ? `https://openlibrary.org/search?q=${book.id}` : '',
            ebook: book.isEbook ? (book.infoLink || `https://books.google.com/books?id=${book.id}`) : '',
            generic: `https://www.google.com/search?q=${searchQuery}+buy+book`
        };
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function generatePlaceholderImage(title) {
        const colors = ['4361ee', '3a0ca3', '7209b7', 'f72585', '4cc9f0'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const initials = title ? title.charAt(0).toUpperCase() : 'B';
        
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'%3E%3Crect width='300' height='450' fill='%23${color}'/%3E%3Ctext x='150' y='225' font-family='Arial' font-size='80' fill='white' text-anchor='middle' dominant-baseline='middle'%3E${initials}%3C/text%3E%3Ctext x='150' y='280' font-family='Arial' font-size='20' fill='white' text-anchor='middle'%3E${encodeURIComponent(title || 'Book Cover')}%3C/text%3E%3C/svg%3E`;
    }

    function formatPrice(price) {
        if (!price || price === 'Not available') return 'Price unavailable';
        if (typeof price === 'string') return price;
        return `$${parseFloat(price).toFixed(2)}`;
    }

    // Filtering and Sorting
    function applyFilters() {
        // Apply page count filter
        let filtered = filterByPageCount(state.allBooks);
        
        // Apply sorting
        filtered = sortBooks(filtered, state.currentSort);
        
        state.filteredBooks = filtered;
        
        // Update display
        displayBooks();
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
    function displayBooks() {
        if (state.filteredBooks.length === 0) {
            showEmptyState('No books match your criteria. Try adjusting your filters.');
            return;
        }

        const startIdx = (state.currentPage - 1) * config.booksPerPage;
        const endIdx = startIdx + config.booksPerPage;
        const booksToDisplay = state.filteredBooks.slice(startIdx, endIdx);

        const booksHTML = booksToDisplay.map(book => createBookCard(book)).join('');
        
        if (elements.bookGrid) {
            elements.bookGrid.innerHTML = booksHTML;
        }
    }

    function createBookCard(book) {
        const primaryGenre = book.categories?.[0] || book.genre || 'General';
        const isWishlisted = state.wishlist.includes(book.id);
        
        return `
            <div class="book-card" role="article" aria-label="${book.title} by ${book.author}">
                <div class="book-cover-container">
                    <img src="${book.thumbnail}" 
                         alt="Cover of ${book.title}"
                         class="book-cover"
                         loading="lazy"
                         width="300"
                         height="380"
                         onerror="this.src='${book.image}'">
                    <span class="book-badge">${primaryGenre}</span>
                </div>
                
                <div class="book-info">
                    <h3 class="book-title">${book.title}</h3>
                    <p class="book-author">By ${book.author}</p>
                    
                    <div class="book-meta">
                        <span class="book-rating">
                            ${generateStarRating(book.rating)}
                            ${book.ratingCount > 0 ? `<small>(${book.ratingCount})</small>` : ''}
                        </span>
                        <span class="book-pages">
                            ${book.pageCount ? `${book.pageCount} pages` : ''}
                        </span>
                    </div>
                    
                    <p class="book-description">
                        ${book.description}
                    </p>
                    
                    <div class="book-footer">
                        <span class="book-price">
                            ${book.price}
                        </span>
                        <div class="book-actions">
                            <a href="${book.primaryPurchaseLink}" 
                               class="btn-buy"
                               target="_blank"
                               rel="noopener noreferrer"
                               aria-label="Buy ${book.title}">
                                <i class="fas fa-shopping-cart"></i>
                                <span>Buy Now</span>
                            </a>
                            <button class="btn-wishlist ${isWishlisted ? 'wishlisted' : ''}" 
                                    onclick="toggleWishlist('${book.id}', this)"
                                    aria-label="${isWishlisted ? 'Remove from' : 'Add to'} wishlist">
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
        
        return `${stars} <span class="rating-text">${rating.toFixed(1)}</span>`;
    }

    // Pagination Functions
    function updatePagination() {
        if (!elements.paginationContainer) return;
        
        const totalPages = Math.ceil(state.filteredBooks.length / config.booksPerPage);
        state.totalPages = totalPages;
        
        if (totalPages <= 1) {
            elements.paginationContainer.innerHTML = '';
            return;
        }
        
        const paginationHTML = createPaginationHTML(totalPages);
        elements.paginationContainer.innerHTML = paginationHTML;
        
        // Attach event listeners to new pagination buttons
        attachPaginationListeners();
    }

    function createPaginationHTML(totalPages) {
        let paginationHTML = `
            <nav class="pagination" role="navigation" aria-label="Pagination">
                <button class="pagination-btn ${state.currentPage === 1 ? 'disabled' : ''}"
                        ${state.currentPage === 1 ? 'disabled' : ''}
                        data-page="${state.currentPage - 1}"
                        aria-label="Previous page">
                    <i class="fas fa-chevron-left"></i>
                    <span>Previous</span>
                </button>
                
                <div class="page-numbers">`;
        
        // Calculate page range to show
        let startPage = Math.max(1, state.currentPage - Math.floor(config.maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + config.maxVisiblePages - 1);
        
        // Adjust start page if we're at the end
        if (endPage - startPage + 1 < config.maxVisiblePages) {
            startPage = Math.max(1, endPage - config.maxVisiblePages + 1);
        }
        
        // Always show first page
        if (startPage > 1) {
            paginationHTML += `
                <button class="pagination-btn ${state.currentPage === 1 ? 'active' : ''}"
                        data-page="1"
                        aria-label="Page 1">
                    1
                </button>`;
            
            if (startPage > 2) {
                paginationHTML += `<span class="pagination-dots" aria-hidden="true">...</span>`;
            }
        }
        
        // Show page numbers
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn ${state.currentPage === i ? 'active' : ''}"
                        data-page="${i}"
                        aria-label="Page ${i}"
                        aria-current="${state.currentPage === i ? 'page' : 'false'}">
                    ${i}
                </button>`;
        }
        
        // Always show last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span class="pagination-dots" aria-hidden="true">...</span>`;
            }
            
            paginationHTML += `
                <button class="pagination-btn ${state.currentPage === totalPages ? 'active' : ''}"
                        data-page="${totalPages}"
                        aria-label="Page ${totalPages}">
                    ${totalPages}
                </button>`;
        }
        
        paginationHTML += `
                </div>
                
                <button class="pagination-btn ${state.currentPage === totalPages ? 'disabled' : ''}"
                        ${state.currentPage === totalPages ? 'disabled' : ''}
                        data-page="${state.currentPage + 1}"
                        aria-label="Next page">
                    <span>Next</span>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </nav>`;
        
        return paginationHTML;
    }

    function attachPaginationListeners() {
        if (!elements.paginationContainer) return;
        
        const paginationBtns = elements.paginationContainer.querySelectorAll('.pagination-btn:not(.disabled)');
        
        paginationBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (!isNaN(page)) {
                    changePage(page);
                }
            });
        });
    }

    function changePage(page) {
        if (page < 1 || page > state.totalPages) {
            return;
        }
        
        state.currentPage = page;
        loadBooks();
        
        // Smooth scroll to top
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        
        showToast(`Page ${page}`, 'info');
    }

    // UI States
    function showLoadingState() {
        if (!elements.bookGrid) return;
        
        elements.bookGrid.innerHTML = `
            <div class="loading-container" aria-live="polite" aria-busy="true">
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p class="loading-text">Discovering amazing books for you...</p>
                </div>
            </div>
        `;
        
        if (elements.paginationContainer) {
            elements.paginationContainer.innerHTML = '';
        }
    }

    function showEmptyState(message) {
        if (!elements.bookGrid) return;
        
        elements.bookGrid.innerHTML = `
            <div class="empty-state" aria-live="polite">
                <div class="empty-icon">
                    <i class="fas fa-book-open"></i>
                </div>
                <h3 class="empty-title">No Books Found</h3>
                <p class="empty-description">${message}</p>
                <button class="btn-buy" onclick="resetFilters()">
                    <i class="fas fa-redo"></i>
                    <span>Reset Filters</span>
                </button>
            </div>
        `;
        
        if (elements.paginationContainer) {
            elements.paginationContainer.innerHTML = '';
        }
    }

    function showErrorState(message) {
        if (!elements.bookGrid) return;
        
        elements.bookGrid.innerHTML = `
            <div class="error-state" aria-live="assertive">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3 class="error-title">Something Went Wrong</h3>
                <p class="error-description">${message}</p>
                <button class="btn-buy" onclick="loadBooks()">
                    <i class="fas fa-sync-alt"></i>
                    <span>Try Again</span>
                </button>
            </div>
        `;
        
        if (elements.paginationContainer) {
            elements.paginationContainer.innerHTML = '';
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
            <button onclick="removeToast('${toastId}')" aria-label="Close notification">
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
            showToast(`"${book.title}" added to wishlist`, 'success');
            
            if (buttonElement) {
                buttonElement.classList.add('wishlisted');
                buttonElement.querySelector('i').className = 'fas fa-heart';
                buttonElement.setAttribute('aria-label', 'Remove from wishlist');
            }
        } else {
            // Remove from wishlist
            state.wishlist.splice(index, 1);
            showToast(`"${book.title}" removed from wishlist`, 'info');
            
            if (buttonElement) {
                buttonElement.classList.remove('wishlisted');
                buttonElement.querySelector('i').className = 'far fa-heart';
                buttonElement.setAttribute('aria-label', 'Add to wishlist');
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
        
        // Update UI
        if (elements.searchInput) elements.searchInput.value = query;
        if (elements.sortSelect) elements.sortSelect.value = sort;
        if (elements.pageCountFilter) elements.pageCountFilter.value = pages;
        
        document.querySelectorAll('.genre-btn').forEach(btn => {
            const isActive = btn.dataset.genre === genre;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive.toString());
        });
        
        applyFilters();
    });

    // Initialize URL state
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
