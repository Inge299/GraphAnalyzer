import React from 'react';
import type { ServiceCategory } from './types';

interface ServiceCategorySidebarProps {
  categories: ServiceCategory[];
  activeCategory: ServiceCategory;
  categoryLabels: Record<ServiceCategory, string>;
  onSelect: (category: ServiceCategory) => void;
}

const ServiceCategorySidebar: React.FC<ServiceCategorySidebarProps> = ({
  categories,
  activeCategory,
  categoryLabels,
  onSelect,
}) => (
  <aside className="service-screen-sidebar">
    <div className="service-screen-title">Сервисные функции</div>
    {categories.map((category) => (
      <button
        key={category}
        type="button"
        className={`service-screen-category ${activeCategory === category ? 'active' : ''}`}
        onClick={() => onSelect(category)}
      >
        {categoryLabels[category]}
      </button>
    ))}
  </aside>
);

export default ServiceCategorySidebar;
