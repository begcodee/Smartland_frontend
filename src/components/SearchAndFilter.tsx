import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  Search, Filter, MapPin, DollarSign, Calendar, 
  SlidersHorizontal, X, RefreshCw
} from 'lucide-react';

interface SearchFilters {
  searchTerm: string;
  location: string;
  priceRange: [number, number];
  areaRange: [number, number];
  status: string;
  dateRange: string;
  owner: string;
}

interface SearchAndFilterProps {
  onFiltersChange: (filters: SearchFilters) => void;
  totalResults: number;
}

function toRangePair(value: number[], fallback: [number, number]): [number, number] {
  if (Array.isArray(value) && value.length >= 2) {
    return [value[0] ?? fallback[0], value[1] ?? fallback[1]];
  }
  return fallback;
}

export const SearchAndFilter = ({ onFiltersChange, totalResults }: SearchAndFilterProps) => {
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    location: '',
    priceRange: [0, 500000],
    areaRange: [0, 5000],
    status: '',
    dateRange: '',
    owner: ''
  });

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const updateFilter = (key: keyof SearchFilters, value: string | [number, number]) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: SearchFilters = {
      searchTerm: '',
      location: '',
      priceRange: [0, 500000],
      areaRange: [0, 5000],
      status: '',
      dateRange: '',
      owner: ''
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.searchTerm) count++;
    if (filters.location) count++;
    if (filters.status) count++;
    if (filters.dateRange) count++;
    if (filters.owner) count++;
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 500000) count++;
    if (filters.areaRange[0] > 0 || filters.areaRange[1] < 5000) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Main Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search properties, locations, owners..."
                value={filters.searchTerm}
                onChange={(e) => updateFilter('searchTerm', e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Dialog open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="relative">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Advanced Filters</DialogTitle>
                  <DialogDescription>
                    Refine your search with detailed criteria
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Location Filter */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Location
                    </Label>
                    <Select value={filters.location} onValueChange={(value) => updateFilter('location', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Locations</SelectItem>
                        <SelectItem value="delhi">New Delhi</SelectItem>
                        <SelectItem value="gurgaon">Gurgaon</SelectItem>
                        <SelectItem value="meerut">Meerut</SelectItem>
                        <SelectItem value="noida">Noida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-2">
                    <Label>Property Status</Label>
                    <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="disputed">Disputed</SelectItem>
                        <SelectItem value="transfer_pending">Transfer Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price Range */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Price Range (Ghana Cedis)
                    </Label>
                    <div className="px-2">
                      <Slider
                        value={filters.priceRange}
                        onValueChange={(value) => updateFilter('priceRange', toRangePair(value, [0, 500000]))}
                        max={500000}
                        min={0}
                        step={5000}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span>₵{filters.priceRange[0].toLocaleString()}</span>
                        <span>₵{filters.priceRange[1].toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Area Range */}
                  <div className="space-y-3">
                    <Label>Area Range (sq meters)</Label>
                    <div className="px-2">
                      <Slider
                        value={filters.areaRange}
                        onValueChange={(value) => updateFilter('areaRange', toRangePair(value, [0, 5000]))}
                        max={5000}
                        min={0}
                        step={100}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span>{filters.areaRange[0]} m²</span>
                        <span>{filters.areaRange[1]} m²</span>
                      </div>
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Registration Date
                    </Label>
                    <Select value={filters.dateRange} onValueChange={(value) => updateFilter('dateRange', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select date range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any time</SelectItem>
                        <SelectItem value="last_month">Last month</SelectItem>
                        <SelectItem value="last_3_months">Last 3 months</SelectItem>
                        <SelectItem value="last_year">Last year</SelectItem>
                        <SelectItem value="last_2_years">Last 2 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Owner Filter */}
                  <div className="space-y-2">
                    <Label>Owner</Label>
                    <Input
                      placeholder="Search by owner name"
                      value={filters.owner}
                      onChange={(e) => updateFilter('owner', e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => setIsAdvancedOpen(false)} className="flex-1">
                      Apply Filters
                    </Button>
                    <Button variant="outline" onClick={clearFilters}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {activeFiltersCount > 0 && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filters.status === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateFilter('status', filters.status === 'active' ? '' : 'active')}
            >
              Active Properties
            </Button>
            <Button
              variant={filters.status === 'disputed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateFilter('status', filters.status === 'disputed' ? '' : 'disputed')}
            >
              Disputed
            </Button>
            <Button
              variant={filters.dateRange === 'last_month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateFilter('dateRange', filters.dateRange === 'last_month' ? '' : 'last_month')}
            >
              Recent
            </Button>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{totalResults} properties found</span>
            {activeFiltersCount > 0 && (
              <span>{activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active</span>
            )}
          </div>

          {/* Active Filters Display */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.searchTerm && (
                <Badge variant="secondary" className="gap-1">
                  Search: {filters.searchTerm}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('searchTerm', '')} />
                </Badge>
              )}
              {filters.location && (
                <Badge variant="secondary" className="gap-1">
                  Location: {filters.location}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('location', '')} />
                </Badge>
              )}
              {filters.status && (
                <Badge variant="secondary" className="gap-1">
                  Status: {filters.status}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('status', '')} />
                </Badge>
              )}
              {filters.owner && (
                <Badge variant="secondary" className="gap-1">
                  Owner: {filters.owner}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('owner', '')} />
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};