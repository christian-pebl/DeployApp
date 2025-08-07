-- Enable the "uuid-ossp" extension to generate UUIDs
create extension if not exists "uuid-ossp";

-- Create projects table
create table projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  user_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create pins table
create table pins (
  id uuid default uuid_generate_v4() primary key,
  lat double precision not null,
  lng double precision not null,
  label text not null,
  notes text,
  label_visible boolean default true,
  user_id uuid references auth.users not null,
  project_id uuid references projects,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create lines table
create table lines (
  id uuid default uuid_generate_v4() primary key,
  path jsonb not null, -- Array of {lat: number, lng: number}
  label text not null,
  notes text,
  label_visible boolean default true,
  user_id uuid references auth.users not null,
  project_id uuid references projects,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create areas table
create table areas (
  id uuid default uuid_generate_v4() primary key,
  path jsonb not null, -- Array of {lat: number, lng: number}
  label text not null,
  notes text,
  label_visible boolean default true,
  fill_visible boolean default true,
  user_id uuid references auth.users not null,
  project_id uuid references projects,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create tags table
create table tags (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  color text not null,
  user_id uuid references auth.users not null,
  project_id uuid references projects not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table projects enable row level security;
alter table pins enable row level security;
alter table lines enable row level security;
alter table areas enable row level security;
alter table tags enable row level security;

-- Create policies for projects
create policy "Users can view own projects" on projects for select using (auth.uid() = user_id);
create policy "Users can insert own projects" on projects for insert with check (auth.uid() = user_id);
create policy "Users can update own projects" on projects for update using (auth.uid() = user_id);
create policy "Users can delete own projects" on projects for delete using (auth.uid() = user_id);

-- Create policies for pins
create policy "Users can view own pins" on pins for select using (auth.uid() = user_id);
create policy "Users can insert own pins" on pins for insert with check (auth.uid() = user_id);
create policy "Users can update own pins" on pins for update using (auth.uid() = user_id);
create policy "Users can delete own pins" on pins for delete using (auth.uid() = user_id);

-- Create policies for lines
create policy "Users can view own lines" on lines for select using (auth.uid() = user_id);
create policy "Users can insert own lines" on lines for insert with check (auth.uid() = user_id);
create policy "Users can update own lines" on lines for update using (auth.uid() = user_id);
create policy "Users can delete own lines" on lines for delete using (auth.uid() = user_id);

-- Create policies for areas
create policy "Users can view own areas" on areas for select using (auth.uid() = user_id);
create policy "Users can insert own areas" on areas for insert with check (auth.uid() = user_id);
create policy "Users can update own areas" on areas for update using (auth.uid() = user_id);
create policy "Users can delete own areas" on areas for delete using (auth.uid() = user_id);

-- Create policies for tags
create policy "Users can view own tags" on tags for select using (auth.uid() = user_id);
create policy "Users can insert own tags" on tags for insert with check (auth.uid() = user_id);
create policy "Users can update own tags" on tags for update using (auth.uid() = user_id);
create policy "Users can delete own tags" on tags for delete using (auth.uid() = user_id);

-- Create functions to automatically update updated_at columns
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger update_projects_updated_at before update on projects
  for each row execute procedure update_updated_at_column();

create trigger update_pins_updated_at before update on pins
  for each row execute procedure update_updated_at_column();

create trigger update_lines_updated_at before update on lines
  for each row execute procedure update_updated_at_column();

create trigger update_areas_updated_at before update on areas
  for each row execute procedure update_updated_at_column();

create trigger update_tags_updated_at before update on tags
  for each row execute procedure update_updated_at_column();