package main
import (
    "fmt"
    "time"
)

func main(){
    sum := 1
    for {
        sum += sum
        fmt.Println(sum)
        time.Sleep(300 * time.Millisecond)
    }
}
