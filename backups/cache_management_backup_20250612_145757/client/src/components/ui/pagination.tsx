import React from 'react';
import { Button } from './button';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

interface PaginationProps {
  total: number;
  limit: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ total, limit, currentPage, onPageChange }: PaginationProps) {
  // Make sure values are valid numbers
  const safeTotal = Number(total) || 0;
  const safeLimit = Number(limit) || 10;
  const safePage = Number(currentPage) || 1;
  
  // Calculate total pages safely
  const totalPages = safeLimit > 0 ? Math.ceil(safeTotal / safeLimit) : 0;
  
  // Don't render pagination if there's only one page or less
  if (totalPages <= 1) {
    return null;
  }
  
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };
  
  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };
  
  // Calculate which page buttons to show
  let pageButtons = [];
  const maxPageButtons = 5;
  
  if (totalPages <= maxPageButtons) {
    // Show all page buttons if there are fewer than max
    for (let i = 1; i <= totalPages; i++) {
      pageButtons.push(i);
    }
  } else {
    // Always show first page, last page, current page, and nearby pages
    pageButtons.push(1);
    
    if (currentPage > 3) {
      pageButtons.push('ellipsis-start');
    }
    
    // Show page buttons around the current page
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pageButtons.push(i);
    }
    
    if (currentPage < totalPages - 2) {
      pageButtons.push('ellipsis-end');
    }
    
    pageButtons.push(totalPages);
  }
  
  return (
    <div className="flex items-center justify-center space-x-2 mt-4">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handlePrevious}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      {pageButtons.map((page, index) => 
        typeof page === 'number' ? (
          <Button
            key={`page-${page}`}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(page)}
            className="min-w-[32px]"
            aria-label={`Page ${page}`}
            aria-current={currentPage === page ? "page" : undefined}
          >
            {page}
          </Button>
        ) : (
          <Button
            key={`${page}-${index}`}
            variant="ghost"
            size="sm"
            disabled
            className="min-w-[32px] cursor-default"
            aria-hidden="true"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )
      )}
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleNext}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function PageSizeSelector({
  options = [10, 25, 50, 100],
  currentLimit,
  onLimitChange
}: {
  options?: number[];
  currentLimit: number;
  onLimitChange: (size: number) => void;
}) {
  return (
    <div className="flex items-center text-sm text-gray-500">
      <span className="mr-2">Rows per page:</span>
      <select
        value={currentLimit}
        onChange={(e) => onLimitChange(Number(e.target.value))}
        className="bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}