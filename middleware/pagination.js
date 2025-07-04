// Pagination middleware
export const paginationMiddleware = (req, res, next) => {
  // Extract pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  // Extract sorting parameters
  const sortBy = req.query.sortBy || 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortOrder };
  
  // Extract search/filter parameters
  const search = req.query.search || '';
  const status = req.query.status || '';
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';
  
  // Add to request object
  req.pagination = {
    page,
    limit,
    skip,
    sort,
    search,
    status,
    startDate,
    endDate
  };
  
  next();
};

// Helper function to create pagination response
export const createPaginationResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null
    }
  };
};

export default {
  paginationMiddleware,
  createPaginationResponse
}; 