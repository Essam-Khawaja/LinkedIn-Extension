"use client"

import type React from "react"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface ProfileInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: "text" | "email" | "url" | "textarea"
  icon?: React.ReactNode
}

export function ProfileInput({ label, value, onChange, placeholder, type = "text", icon }: ProfileInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-foreground flex items-center gap-2">
        {icon}
        {label}
      </Label>
      {type === "textarea" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[100px] bg-muted border-border text-foreground placeholder:text-muted-foreground resize-none"
        />
      ) : (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
        />
      )}
    </div>
  )
}
